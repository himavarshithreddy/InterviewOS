import { FinalReport } from '@/types';

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
};

/**
 * Generate HTML content for the interview report
 */
function generateReportHTML(report: FinalReport, filename: string): string {
  const averageScore = Math.round(
    (report.technicalScore + report.communicationScore + report.cultureFitScore) / 3
  );
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Report - ${filename}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #1f2937; line-height: 1.6; }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; margin-top: 2rem; margin-bottom: 0.75rem; color: #374151; }
    .header { text-align: center; margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid #e5e7eb; }
    .score { font-size: 3rem; font-weight: 700; color: #2563eb; }
    .scores { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 1rem 0; }
    .score-item { flex: 1; min-width: 140px; padding: 1rem; background: #f9fafb; border-radius: 8px; }
    .score-item strong { display: block; font-size: 0.875rem; color: #6b7280; }
    .score-item span { font-size: 1.5rem; font-weight: 600; }
    .feedback { background: #f9fafb; padding: 1rem 1.25rem; border-radius: 8px; margin: 1rem 0; white-space: pre-line; }
    ul { margin: 0.5rem 0; padding-left: 1.5rem; }
    li { margin: 0.5rem 0; }
    .panelist { background: #f9fafb; padding: 1rem; border-radius: 8px; margin: 0.75rem 0; border-left: 4px solid #2563eb; }
    .panelist-name { font-weight: 600; margin-bottom: 0.25rem; }
    .panelist-comment { color: #4b5563; font-style: italic; }
    .meta { color: #9ca3af; font-size: 0.875rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Interview Evaluation Report</h1>
    <p class="meta">Generated on ${date}</p>
    <div class="score">${averageScore}<span style="font-size: 1.5rem; color: #6b7280;">/100</span></div>
  </div>

  <h2>Score Breakdown</h2>
  <div class="scores">
    <div class="score-item"><strong>Technical</strong><span>${report.technicalScore}/100</span></div>
    <div class="score-item"><strong>Communication</strong><span>${report.communicationScore}/100</span></div>
    <div class="score-item"><strong>Culture Fit</strong><span>${report.cultureFitScore}/100</span></div>
  </div>

  <h2>Detailed Feedback</h2>
  <div class="feedback">${report.detailedFeedback}</div>

  <h2>Suggested Improvements</h2>
  <ul>
    ${report.improvements.map((imp) => `<li>${imp}</li>`).join('\n    ')}
  </ul>

  <h2>Panelist Remarks</h2>
  ${report.panelistComments
    .map(
      (pc) => `
  <div class="panelist">
    <div class="panelist-name">${pc.name}</div>
    <div class="panelist-comment">"${pc.comment}"</div>
  </div>`
    )
    .join('\n')}

  <p class="meta">— InterviewOS Evaluation Report</p>
</body>
</html>`;
}

/**
 * Download report as HTML file
 */
export function downloadReport(report: FinalReport, filename = 'interview-report'): void {
  const sanitized = filename.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
  const fullFilename = `${sanitized || 'interview-report'}-${Date.now()}.html`;
  const html = generateReportHTML(report, fullFilename);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fullFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
