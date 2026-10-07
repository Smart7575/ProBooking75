import { InvoiceLineItem, InvoiceSettings, Invoice } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function formatInvoiceNumber(
  prefix: string,
  padding: number,
  sequence: number,
  date: Date = new Date()
): string {
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  const formattedPrefix = prefix
    .replace(/\{YYYY\}/gi, yyyy)
    .replace(/\{YY\}/gi, yy)
    .replace(/\{MM\}/gi, mm)
    .replace(/\{DD\}/gi, dd);

  const numStr = String(sequence).padStart(Math.max(1, padding), '0');
  return `${formattedPrefix}${numStr}`;
}

export function calculateInvoiceTotals(items: InvoiceLineItem[]): {
  subtotal: number;
  totalVat: number;
  totalAmount: number;
  vatBreakdown: Record<number, { base: number; vat: number }>;
} {
  let subtotal = 0;
  let totalVat = 0;
  const vatBreakdown: Record<number, { base: number; vat: number }> = {};

  items.forEach((item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const vatRate = Number(item.vatRate) || 0;

    let lineNet: number;
    let vat: number;

    if (item.isVatInclusive && item.baseAmount !== undefined) {
      const lineGross = Math.round(qty * Number(item.baseAmount) * 100) / 100;
      lineNet = vatRate > 0 ? Math.round((lineGross / (1 + vatRate / 100)) * 100) / 100 : lineGross;
      vat = Math.round((lineGross - lineNet) * 100) / 100;
    } else {
      lineNet = Math.round(qty * price * 100) / 100;
      vat = Math.round(((lineNet * vatRate) / 100) * 100) / 100;
    }

    subtotal += lineNet;
    totalVat += vat;

    if (!vatBreakdown[vatRate]) {
      vatBreakdown[vatRate] = { base: 0, vat: 0 };
    }
    vatBreakdown[vatRate].base = Math.round((vatBreakdown[vatRate].base + lineNet) * 100) / 100;
    vatBreakdown[vatRate].vat = Math.round((vatBreakdown[vatRate].vat + vat) * 100) / 100;
  });

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalVat: Math.round(totalVat * 100) / 100,
    totalAmount: Math.round((subtotal + totalVat) * 100) / 100,
    vatBreakdown,
  };
}

const colorConversionCache = new Map<string, string>();
let sharedColorCanvasCtx: CanvasRenderingContext2D | null = null;

function getColorCanvasContext(): CanvasRenderingContext2D | null {
  if (sharedColorCanvasCtx) return sharedColorCanvasCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  sharedColorCanvasCtx = canvas.getContext('2d', { willReadFrequently: true });
  return sharedColorCanvasCtx;
}

function convertCssColorToRgb(colorStr: string): string {
  const trimmed = colorStr.trim();
  const cached = colorConversionCache.get(trimmed);
  if (cached) return cached;

  const ctx = getColorCanvasContext();
  if (!ctx) return 'rgb(15, 23, 42)';

  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillStyle = trimmed;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    let result: string;
    if (a === 0) {
      result = 'rgba(0, 0, 0, 0)';
    } else if (a < 255) {
      result = `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
    } else {
      result = `rgb(${r}, ${g}, ${b})`;
    }
    colorConversionCache.set(trimmed, result);
    return result;
  } catch {
    return 'rgb(15, 23, 42)';
  }
}

const UNSUPPORTED_COLOR_FN_REGEX = /\b(oklch|oklab|lch|lab|hwb|color-mix|color|light-dark)\s*\(/gi;

function hasUnsupportedColorFunction(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('okl') ||
    lower.includes('lch(') ||
    lower.includes('lab(') ||
    lower.includes('hwb(') ||
    lower.includes('color-mix(') ||
    lower.includes('color(') ||
    lower.includes('light-dark(')
  );
}

function sanitizeUnsupportedCssColors(cssText: string): string {
  if (!hasUnsupportedColorFunction(cssText)) {
    return cssText;
  }

  let result = '';
  let lastIndex = 0;
  UNSUPPORTED_COLOR_FN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = UNSUPPORTED_COLOR_FN_REGEX.exec(cssText)) !== null) {
    const startIdx = match.index;
    const openParenIdx = startIdx + match[0].length - 1;
    let depth = 1;
    let i = openParenIdx + 1;

    while (i < cssText.length && depth > 0) {
      const ch = cssText[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }

    result += cssText.slice(lastIndex, startIdx);
    const fullFnCall = cssText.slice(startIdx, i);

    if (depth === 0) {
      if (fullFnCall.includes('var(')) {
        result += 'rgba(0, 0, 0, 0)';
      } else {
        result += convertCssColorToRgb(fullFnCall);
      }
    } else {
      result += 'rgb(15, 23, 42)';
    }

    lastIndex = i;
    UNSUPPORTED_COLOR_FN_REGEX.lastIndex = i;
  }

  result += cssText.slice(lastIndex);
  return result;
}

function createSanitizedComputedStyleProxy(style: CSSStyleDeclaration): CSSStyleDeclaration {
  return new Proxy(style, {
    get(target, prop) {
      if (prop === 'getPropertyValue') {
        return (name: string) => {
          const val = target.getPropertyValue(name);
          return typeof val === 'string' ? sanitizeUnsupportedCssColors(val) : val;
        };
      }
      const value = Reflect.get(target, prop, target);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      if (typeof value === 'string') {
        return sanitizeUnsupportedCssColors(value);
      }
      return value;
    },
  });
}

export async function downloadInvoicePdf(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id ${elementId} not found`);
  }

  // Collect sanitized CSS from all document stylesheets so cloned document has no oklch/oklab
  const collectedCssRules: string[] = [];
  try {
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        const rules = sheet.cssRules;
        if (!rules) return;
        for (let i = 0; i < rules.length; i++) {
          collectedCssRules.push(sanitizeUnsupportedCssColors(rules[i].cssText));
        }
      } catch {
        // Cross-origin stylesheet; ignore
      }
    });
  } catch {
    // Ignore stylesheet iteration errors
  }

  // Temporarily wrap window.getComputedStyle so html2canvas never receives oklch/oklab/color-mix
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
    const rawStyle = originalGetComputedStyle.call(window, elt, pseudoElt);
    return createSanitizedComputedStyleProxy(rawStyle);
  };

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2, // 2x high resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1024,
      onclone: (clonedDoc) => {
        const win = clonedDoc.defaultView;
        if (win && win.getComputedStyle) {
          const origCloneGetComputedStyle = win.getComputedStyle;
          win.getComputedStyle = function (
            elt: Element,
            pseudoElt?: string | null
          ): CSSStyleDeclaration {
            const rawStyle = origCloneGetComputedStyle.call(win, elt, pseudoElt);
            return createSanitizedComputedStyleProxy(rawStyle);
          };
        }

        // Sanitize all <style> elements in the cloned document
        const styleTags = clonedDoc.querySelectorAll('style');
        styleTags.forEach((styleEl) => {
          if (styleEl.textContent) {
            styleEl.textContent = sanitizeUnsupportedCssColors(styleEl.textContent);
          }
        });

        // Replace external <link rel="stylesheet"> with sanitized inline <style>
        if (collectedCssRules.length > 0) {
          const linkTags = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
          linkTags.forEach((linkEl) => linkEl.remove());
          const injectedStyle = clonedDoc.createElement('style');
          injectedStyle.textContent = collectedCssRules.join('\n');
          clonedDoc.head.appendChild(injectedStyle);
        }

        // Also sanitize any remaining computed or inline styles on all elements in clonedDoc
        if (win) {
          const allNodes = [
            clonedDoc.documentElement,
            ...Array.from(clonedDoc.querySelectorAll<HTMLElement>('*')),
          ];
          const colorProps = [
            'color',
            'background-color',
            'border-color',
            'border-top-color',
            'border-right-color',
            'border-bottom-color',
            'border-left-color',
            'outline-color',
            'text-decoration-color',
            '-webkit-text-stroke-color',
            '-webkit-text-fill-color',
            'column-rule-color',
            'caret-color',
            'accent-color',
            'fill',
            'stroke',
            'stop-color',
            'flood-color',
            'lighting-color',
          ];
          allNodes.forEach((node) => {
            if (!node || !node.style) return;
            const inlineStyle = node.getAttribute('style');
            if (inlineStyle && hasUnsupportedColorFunction(inlineStyle)) {
              node.setAttribute('style', sanitizeUnsupportedCssColors(inlineStyle));
            }
            const computed = win.getComputedStyle(node);
            colorProps.forEach((prop) => {
              const val = computed.getPropertyValue(prop);
              if (val && hasUnsupportedColorFunction(val)) {
                node.style.setProperty(prop, sanitizeUnsupportedCssColors(val), 'important');
              }
            });
            const boxShadow = computed.getPropertyValue('box-shadow');
            if (boxShadow && hasUnsupportedColorFunction(boxShadow)) {
              node.style.setProperty(
                'box-shadow',
                sanitizeUnsupportedCssColors(boxShadow),
                'important'
              );
            }
            const textShadow = computed.getPropertyValue('text-shadow');
            if (textShadow && hasUnsupportedColorFunction(textShadow)) {
              node.style.setProperty(
                'text-shadow',
                sanitizeUnsupportedCssColors(textShadow),
                'important'
              );
            }
            const bgImage = computed.getPropertyValue('background-image');
            if (bgImage && hasUnsupportedColorFunction(bgImage)) {
              node.style.setProperty(
                'background-image',
                sanitizeUnsupportedCssColors(bgImage),
                'important'
              );
            }
          });
        }
        const targetClone = clonedDoc.getElementById(elementId);
        if (targetClone) {
          targetClone.style.minHeight = '0';
          targetClone.style.height = 'auto';
          targetClone.style.border = 'none';
          targetClone.style.boxShadow = 'none';
          targetClone.style.borderRadius = '0';
        }
      },
    });
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // If the content fits on 1 page (or only slightly exceeds 1 page due to padding), keep it on 1 page
  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  } else if (imgHeight <= pageHeight * 1.15) {
    const fitScale = pageHeight / imgHeight;
    const scaledWidth = imgWidth * fitScale;
    const xOffset = (pageWidth - scaledWidth) / 2;
    pdf.addImage(imgData, 'PNG', xOffset, 0, scaledWidth, pageHeight);
  } else {
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Only add another page if there is meaningful remaining content (> 12mm, beyond bottom padding)
    while (heightLeft > 12) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
  }

  pdf.save(`${filename}.pdf`);
}

export function isDemoTrainerName(name: string | undefined | null, currentEmail?: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  const isDemoEmail =
    currentEmail === 'alex@probooking.nl' || currentEmail === 'mark@jansen-performance.nl';
  if (isDemoEmail) return false;
  return (
    trimmed === 'Alex Jansen' ||
    trimmed === 'Mark Jansen' ||
    trimmed === 'Jansen Performance Coaching' ||
    trimmed === 'Mark Jansen Coaching' ||
    trimmed === 'Alex Jansen Coaching'
  );
}

export function getLocalizedInvoiceNote(
  note: string | undefined | null,
  language?: string,
  businessName?: string
): string {
  if (!note) return '';

  let trimmed = note.trim();
  const cleanBizName =
    businessName && !isDemoTrainerName(businessName) ? businessName.trim() : '';

  if (cleanBizName) {
    trimmed = trimmed.replace(/Jansen Performance Coaching/g, cleanBizName);
    trimmed = trimmed.replace(/Mark Jansen Coaching/g, cleanBizName);
    trimmed = trimmed.replace(/Alex Jansen Coaching/g, cleanBizName);
  }

  // Translate known Dutch default boilerplate notes to English
  if (
    trimmed.includes('Gelieve het factuurnummer te vermelden bij de betaling')
  ) {
    return cleanBizName
      ? `Please quote the invoice number when making the payment. Thank you for your trust in ${cleanBizName}!`
      : 'Please quote the invoice number when making the payment. Thank you for your trust!';
  }
  if (
    trimmed === 'Gelieve het factuurnummer te vermelden bij de overschrijving.' ||
    trimmed.includes('Gelieve het factuurnummer te vermelden bij de overschrijving')
  ) {
    return 'Please quote the invoice number when making the bank transfer.';
  }

  return trimmed;
}
