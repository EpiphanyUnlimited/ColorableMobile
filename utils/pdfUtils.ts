
import { jsPDF } from 'jspdf';

const drawColorableText = (pdf: jsPDF, text: string, x: number, y: number, fontSize: number, align: 'center' | 'left' | 'right') => {
  pdf.setFontSize(fontSize);
  pdf.setLineWidth(0.3); // Slightly thinner line for cleaner coloring outlines
  pdf.setDrawColor(0, 0, 0); // Black outline

  // renderingMode: 1 is the API way to set "Outline" (Stroke) mode in jsPDF
  // We use the options object if available, otherwise manual set
  const options: any = {
    align,
    renderingMode: 'stroke'
  };

  pdf.text(text, x, y, options);
};

// Helper function to detect if image is landscape and get dimensions
async function getImageDimensions(url: string): Promise<{ width: number; height: number; isLandscape: boolean }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      resolve({
        width,
        height,
        isLandscape: width > height
      });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

const COVER_TEMPLATES = {
  'standard': (pdf: jsPDF, title: string, w: number, h: number, isPaid: boolean, fontFamily: string) => {
    const displayFont = fontFamily === 'generic' ? 'helvetica' : fontFamily;
    pdf.setFont(displayFont, "bold");
    if (isPaid) {
      drawColorableText(pdf, title.toUpperCase(), w / 2, h / 3, 40, 'center');
    } else {
      pdf.setFontSize(40);
      pdf.setTextColor(0, 0, 0);
      pdf.text(title.toUpperCase(), w / 2, h / 3, { align: 'center' });
    }
  },
  'playful': (pdf: jsPDF, title: string, w: number, h: number, isPaid: boolean, fontFamily: string) => {
    const displayFont = fontFamily === 'generic' ? 'courier' : fontFamily;
    pdf.setFont(displayFont, "bold");
    if (isPaid) {
      drawColorableText(pdf, title, w / 2, h / 3, 45, 'center');
    } else {
      pdf.setFontSize(45);
      pdf.text(title, w / 2, h / 3, { align: 'center' });
    }
  },
  'elegant': (pdf: jsPDF, title: string, w: number, h: number, isPaid: boolean, fontFamily: string) => {
    const displayFont = fontFamily === 'generic' ? 'times' : fontFamily;
    pdf.setFont(displayFont, "italic");
    if (isPaid) {
      drawColorableText(pdf, title, w / 2, h / 3, 50, 'center');
    } else {
      pdf.setFontSize(50);
      pdf.text(title, w / 2, h / 3, { align: 'center' });
    }
  },
  'modern': (pdf: jsPDF, title: string, w: number, h: number, isPaid: boolean, fontFamily: string) => {
    const displayFont = fontFamily === 'generic' ? 'helvetica' : fontFamily;
    pdf.setFont(displayFont, "normal");
    const lines = title.split(' ');
    if (isPaid) {
      lines.forEach((line, i) => {
        drawColorableText(pdf, line, w / 2, h / 4 + (i * 25), 55, 'center');
      });
    } else {
      pdf.setFontSize(55);
      pdf.text(title.split(' ').join('\n'), w / 2, h / 4, { align: 'center' });
    }
  },
  'bold': (pdf: jsPDF, title: string, w: number, h: number, isPaid: boolean, fontFamily: string) => {
    const displayFont = fontFamily === 'generic' ? 'helvetica' : fontFamily;
    pdf.setFont(displayFont, "bold");
    if (isPaid) {
      drawColorableText(pdf, title, w / 2, h / 2, 60, 'center');
    } else {
      pdf.setFontSize(60);
      pdf.text(title, w / 2, h / 2, { align: 'center' });
    }
  }
};

export async function generateColoringBookPDF(
  imageUrls: string[],
  title: string,
  templateId: string = 'standard',
  fontFamily: string = 'helvetica',
  overlays: (string | null)[] = [],
  isPaid: boolean = false
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // COVER PAGE
  const drawCover = COVER_TEMPLATES[templateId as keyof typeof COVER_TEMPLATES] || COVER_TEMPLATES.standard;
  pdf.setTextColor(0, 0, 0);
  drawCover(pdf, title, pageWidth, pageHeight, isPaid, fontFamily);

  // Apply selected font to cover subtitle
  const displayFont = fontFamily === 'generic' ? 'helvetica' : fontFamily;
  pdf.setFontSize(14);
  pdf.setFont(displayFont, "normal");
  pdf.text("by Epiphany Unlimited, Inc", pageWidth / 2, (pageHeight / 3) + 20, { align: 'center' });

  // PAGES
  for (let i = 0; i < imageUrls.length; i++) {
    pdf.addPage();
    const url = imageUrls[i];

    // Detect if image is landscape
    let isLandscapeImage = false;
    try {
      const { isLandscape } = await getImageDimensions(url);
      isLandscapeImage = isLandscape;

      if (isLandscape) {
        // For landscape images, rotate 90° counter-clockwise to fit on portrait page
        // With 90° rotation in jsPDF, the image rotates around its top-left corner
        // So we need to position it at the TOP-RIGHT of where we want it to end up
        const imgWidth = pageHeight - 60;   // Width after rotation (fits page height)
        const imgHeight = pageWidth - 20;   // Height after rotation (fits page width)

        // Position at top-right corner of the page, accounting for margins
        // After 90° counter-clockwise rotation, this will place the image correctly
        const x = pageWidth - 10;  // Right edge minus margin
        const y = 30;  // Top margin

        pdf.addImage(url, 'PNG', x, y, imgWidth, imgHeight, undefined, 'FAST', 90);
      } else {
        // Portrait or square images - add normally, centered
        pdf.addImage(url, 'PNG', 10, 30, pageWidth - 20, pageHeight - 60);
      }
    } catch (error) {
      // If detection fails, add image normally
      console.warn('Failed to detect image orientation, adding normally:', error);
      pdf.addImage(url, 'PNG', 10, 30, pageWidth - 20, pageHeight - 60);
    }

    // Add text overlays if they exist (Paid feature)
    if (overlays[i]) {
      pdf.setFont(displayFont, 'bold');

      if (isLandscapeImage) {
        // For landscape images rotated 90°, text should be at bottom-center
        // After 90° rotation, "bottom" is actually high X, centered Y
        // We want text to appear at bottom of rotated image, which is the right edge
        const textX = pageWidth * 0.95;  // 95% of page width (near right edge/bottom after rotation)
        const textY = pageHeight / 2;    // Vertically centered (middle of image width after rotation)

        if (isPaid) {
          // For paid users, use colorable text (stroke mode) with rotation
          pdf.setFontSize(24);
          pdf.setLineWidth(0.3);
          pdf.setDrawColor(0, 0, 0);
          pdf.text(overlays[i]!, textX, textY, { align: 'center', angle: 90, renderingMode: 'stroke' });
        } else {
          pdf.setFontSize(24);
          pdf.text(overlays[i]!, textX, textY, { align: 'center', angle: 90 });
        }
      } else {
        // For portrait images, keep text at bottom (normal orientation)
        if (isPaid) {
          drawColorableText(pdf, overlays[i]!, pageWidth / 2, pageHeight - 20, 24, 'center');
        } else {
          pdf.setFontSize(24);
          pdf.text(overlays[i]!, pageWidth / 2, pageHeight - 20, { align: 'center' });
        }
      }
    }

    // Apply selected font to page footer
    pdf.setFontSize(10);
    pdf.setFont(displayFont, "normal");
    pdf.text(`- ${title} -`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  return pdf;
}
