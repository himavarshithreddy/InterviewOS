import { FinalReport } from '@/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/** Sample report for preview/demo purposes */
export const SAMPLE_REPORT: FinalReport = {
  technicalScore: 82,
  communicationScore: 78,
  cultureFitScore: 85,
  detailedFeedback:
    'The candidate demonstrated strong technical fundamentals with clear explanations of system design concepts. ' +
    'Communication was generally effective, though pacing could be improved in complex answers. ' +
    'Enthusiasm and cultural alignment came through well. Consider practicing more concise responses under time pressure.',
  improvements: [
    'Structure technical answers with a brief overview before diving into details',
    'Practice time-boxing responses to stay within 2–3 minutes per question',
    'Include more specific examples from past projects when discussing impact',
  ],
  panelistComments: [
    {
      name: 'Sarah Chen',
      comment:
        'Solid technical depth. The candidate showed good understanding of distributed systems. Would recommend more practice with whiteboard scenarios.',
    },
    {
      name: 'Marcus Johnson',
      comment:
        'Clear communicator. Good eye contact and engagement. Could work on reducing filler words when thinking through complex problems.',
    },
    {
      name: 'Elena Rodriguez',
      comment:
        'Great fit for our team culture. Brought enthusiasm and asked thoughtful questions. Excited to see the candidate in the next round.',
    },
  ],

  // Comprehensive Analysis Data
  bodyLanguageAnalysis: {
    overallScore: 80,
    grade: 'B',
    posture: {
      score: 0.85,
      recommendation: 'Excellent posture maintained throughout most of the interview'
    },
    eyeContact: {
      score: 0.78,
      percentage: 78,
      recommendation: 'Good eye contact, occasional glances away when thinking'
    },
    gestures: {
      score: 0.82,
      frequency: 'appropriate',
      recommendation: 'Natural and engaging hand gestures that emphasize key points'
    },
    facialExpression: {
      score: 0.75,
      variety: 0.7,
      recommendation: 'Good range of expressions showing engagement and enthusiasm'
    },
    strengths: [
      'Confident posture throughout the interview',
      'Engaging hand gestures that support communication',
      'Good facial variety showing genuine interest'
    ],
    improvements: [
      'Maintain eye contact during longer explanations',
      'Reduce fidgeting when thinking through complex problems'
    ]
  },

  emotionAnalysis: {
    averageConfidence: 0.75,
    averageNervousness: 0.28,
    averageEnthusiasm: 0.82,
    overallSentiment: 'positive',
    sentimentScore: 0.65,
    voiceCharacteristics: {
      pace: 'optimal',
      clarity: 0.85,
      volume: 'optimal'
    },
    recommendations: [
      'Excellent enthusiasm and positive energy throughout',
      'Confidence improved as interview progressed',
      'Voice clarity and pace were well-controlled'
    ]
  },

  speechPatterns: {
    averagePace: 145, // words per minute
    fillerWordCount: 12,
    fillerWords: ['um', 'uh', 'like', 'you know'],
    clarityScore: 0.85,
    pauseAnalysis: 'Good use of pauses for emphasis, occasional hesitation on complex topics',
    recommendations: [
      'Reduce filler words by 30-40% through practice',
      'Use intentional pauses instead of "um" when thinking',
      'Maintain current speaking pace - it\'s optimal for comprehension'
    ]
  },

  temporalTrends: {
    confidenceTrend: [
      { timestamp: 0, value: 0.65 },
      { timestamp: 300000, value: 0.72 },
      { timestamp: 600000, value: 0.78 },
      { timestamp: 900000, value: 0.82 },
      { timestamp: 1200000, value: 0.85 }
    ],
    nervousnessTrend: [
      { timestamp: 0, value: 0.45 },
      { timestamp: 300000, value: 0.35 },
      { timestamp: 600000, value: 0.28 },
      { timestamp: 900000, value: 0.22 },
      { timestamp: 1200000, value: 0.18 }
    ],
    engagementTrend: [
      { timestamp: 0, value: 0.75 },
      { timestamp: 300000, value: 0.80 },
      { timestamp: 600000, value: 0.85 },
      { timestamp: 900000, value: 0.88 },
      { timestamp: 1200000, value: 0.90 }
    ]
  },

  analysisNote: '⚠️ Body language, voice, temporal, and spatial analysis use sample/demonstration data due to API rate limits on the free tier. Core scores (Technical, Communication, Culture Fit) and panelist feedback are based on your actual interview transcript.'
};



/**
 * Download report as PDF with charts
 */
export async function downloadReportAsPDF(elementId: string, filename = 'interview-report'): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Report element not found');
    return;
  }

  try {
    // Capture the element as canvas with high quality
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff', // White background for PDF
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          // 1. Force light theme text colors & remove alignment-breaking styles
          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach((el) => {
            const classList = el.classList;

            // Fix Color Contrast
            if (classList.contains('text-gray-200')) {
              classList.remove('text-gray-200');
              classList.add('text-slate-900');
            }
            if (classList.contains('text-gray-400')) {
              classList.remove('text-gray-400');
              classList.add('text-slate-600');
            }
            if (classList.contains('text-white')) {
              classList.remove('text-white');
              classList.add('text-slate-900');
            }

            // Remove letter spacing which often breaks html2canvas text alignment
            if (classList.contains('tracking-tight')) classList.remove('tracking-tight');
            if (classList.contains('tracking-tighter')) classList.remove('tracking-tighter');
            if (classList.contains('tracking-wide')) classList.remove('tracking-wide');
            if (classList.contains('tracking-wider')) classList.remove('tracking-wider');
            if (classList.contains('tracking-widest')) classList.remove('tracking-widest');

            // Handle Glass Effects -> Solid White
            if (classList.contains('glass')) {
              classList.remove('glass');
              classList.add('bg-white', 'border-slate-200');
              const htmlEl = el as HTMLElement;
              htmlEl.style.background = 'white';
              htmlEl.style.backdropFilter = 'none';
              htmlEl.style.boxShadow = 'none';
              htmlEl.style.border = '1px solid #cbd5e1'; // Darker border
            }

            // Handle borders
            if (classList.contains('border-white/20') || classList.contains('border-white/10')) {
              classList.remove('border-white/20', 'border-white/10');
              classList.add('border-slate-200');
            }

            // Handle secondary backgrounds
            if (classList.contains('bg-white/[0.04]') || classList.contains('bg-white/[0.06]')) {
              classList.remove('bg-white/[0.04]', 'bg-white/[0.06]');
              classList.add('bg-slate-50');
            }
          });

          // 2. Fix Chart Colors (Recharts uses SVG)
          // Grid lines - Make them much darker (#94a3b8 = slate-400)
          const gridLines = clonedElement.querySelectorAll('.recharts-cartesian-grid-horizontal line, .recharts-polar-grid-angle line, .recharts-polar-grid-concentric circle, .recharts-polar-grid-concentric path');
          gridLines.forEach(line => {
            line.setAttribute('stroke', '#94a3b8');
          });

          // Chart text/ticks - Dark Slate (#334155)
          const ticks = clonedElement.querySelectorAll('.recharts-text');
          ticks.forEach(text => {
            text.setAttribute('fill', '#334155');
          });

          // 3. Fix Icons (Lucide SVGs)
          // Ensure they are visible if they were white/light
          const icons = clonedElement.querySelectorAll('svg.lucide');
          icons.forEach(icon => {
            // If it heavily relies on currentColor and parent was changed, it should be fine.
            // But explicit check helps.
            const parent = icon.parentElement;
            if (parent && (parent.classList.contains('text-white') || parent.classList.contains('text-gray-200') || parent.classList.contains('text-primary'))) {
              // Keep primary color if it's primary, but darken it slightly for print? 
              // Actually primary (cyan-400) is okay-ish, but check contrast.
              // If parent was text-white/gray, force dark.
            }
            // Force stroke to slate-800 if it looks like it might be white
            const style = window.getComputedStyle(icon);
            if (style.stroke === 'rgb(255, 255, 255)' || icon.getAttribute('stroke') === '#ffffff' || icon.classList.contains('text-white')) {
              icon.setAttribute('stroke', '#1e293b');
            }
          });
        }
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 0;

    // Add image to PDF
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

    // If content is taller than one page, add more pages
    let heightLeft = imgHeight * ratio - pdfHeight;
    let position = -pdfHeight;

    while (heightLeft > 0) {
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', imgX, position, imgWidth * ratio, imgHeight * ratio);
      heightLeft -= pdfHeight;
      position -= pdfHeight;
    }

    // Download the PDF
    const sanitized = filename.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    const fullFilename = `${sanitized || 'interview-report'}-${Date.now()}.pdf`;
    pdf.save(fullFilename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
}

/**
 * Open report in a new tab using the application route for exact styling
 */
export function openReportInNewTab(): void {
  // Use hash router or history API depending on configuration, 
  // but standard window.open should work with the created route
  window.open('/sample-report', '_blank');
}
