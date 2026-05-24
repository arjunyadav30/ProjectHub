import { useEffect, useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Input } from '../../components/common';
import { reportAPI } from '../../api';
import toast from 'react-hot-toast';
import {
  ChevronLeft, ChevronRight, Plus, Trash2,
  Download, Save, FileText, Users, BookOpen,
  GraduationCap, List, AlignLeft, Layers, Eye, Upload, X
} from 'lucide-react';

const uid = () => Math.random().toString(36).slice(2, 8);

const defaultData = () => ({
  project_title: '',
  group_no: '',
  degree: 'BACHELOR OF TECHNOLOGY',
  branch: 'COMPUTER SCIENCE & ENGINEERING',
  submission_month_year: 'December – 2025',
  certificate_period: 'Jul-2025 to Dec-2025',
  members: [{ id: uid(), name: '', enrollment: '' }],
  guide_name: '',
  guide_designation: 'Associate Professor',
  hod_name: 'Prof. Nargish Gupta',
  principal_name: 'Dr. Manish Billore',
  project_coordinator: 'Prof. Mayank Kurchaniya',
  institute: 'Sagar Institute of Science & Technology (SISTec), Bhopal (M.P)',
  department: 'Department of Computer Science & Engineering',
  logo_base64: '',
  abstract: '',
  abbreviations: [{ id: uid(), abbr: '', desc: '' }],
  figures: [{ id: uid(), fig_no: 'Figure 1.1', title: '', page_no: '' }],
  toc_extra: [],
  chapters: [{
    id: uid(),
    number: 1,
    title: 'Introduction',
    toc_page: '1',
    title_size: 17,
    title_bold: true,
    subheading_size: 13,
    content_size: 11,
    content: '',
    sections: [{ id: uid(), code: '1.1', heading: '', toc_page: '1', content: '' }],
  }],
  ref_journals: [{ id: uid(), text: '' }],
  ref_websites: [{ id: uid(), text: '' }],
  project_summary: {
    about: [
      { id: uid(), q: 'Title of the project', a: '' },
      { id: uid(), q: 'Semester', a: '' },
      { id: uid(), q: 'Members', a: '' },
      { id: uid(), q: 'Team Leader', a: '' },
      { id: uid(), q: 'Describe role of every member in the project', a: '' },
      { id: uid(), q: 'What is the motivation for selecting this project?', a: '' },
      { id: uid(), q: 'Project Type (Desktop Application, Web Application, Mobile App, Web)', a: '' },
    ],
    tools: [
      { id: uid(), q: 'Programming language used', a: '' },
      { id: uid(), q: 'IDE used (with version)', a: '' },
      { id: uid(), q: 'Front End Technologies (with version, wherever Applicable)', a: '' },
      { id: uid(), q: 'Back End Technologies (with version, wherever applicable)', a: '' },
      { id: uid(), q: 'Database used (with version)', a: '' },
    ],
    design: [
      { id: uid(), q: 'Is prototype of the software developed?', a: '' },
      { id: uid(), q: 'SDLC model followed (Waterfall, Agile, Spiral etc.)', a: '' },
      { id: uid(), q: 'Why above SDLC model is followed?', a: '' },
      { id: uid(), q: 'Justify that the SDLC model mentioned above is followed in the project.', a: '' },
      { id: uid(), q: 'Software Design approach followed (Functional or Object Oriented)', a: '' },
      { id: uid(), q: 'Name the diagrams developed (According to the Design approach followed)', a: '' },
      { id: uid(), q: 'In case Object Oriented approach is followed, which of the OOPS principles are covered in design?', a: '' },
      { id: uid(), q: 'No. of Tiers (example 3-tier)', a: '' },
      { id: uid(), q: 'Total no. of front-end pages', a: '' },
      { id: uid(), q: 'Total no. of tables in database', a: '' },
      { id: uid(), q: 'Database in which Normal Form?', a: '' },
      { id: uid(), q: 'Are the entries in database encrypted?', a: '' },
      { id: uid(), q: 'Front end validations applied (Yes / No)', a: '' },
      { id: uid(), q: 'Session management done (in case of web applications)', a: '' },
      { id: uid(), q: 'Is application browser compatible (in case of web applications)', a: '' },
      { id: uid(), q: 'Exception handling done (Yes / No)', a: '' },
    ],
    requirements: [
      { id: uid(), q: 'Problem statement clearly defined?', a: '' },
      { id: uid(), q: 'Functional requirements documented?', a: '' },
      { id: uid(), q: 'Non-functional requirements considered (security, performance, usability)?', a: '' },
      { id: uid(), q: 'Feasibility study performed (technical/economic/operational)?', a: '' },
      { id: uid(), q: 'Scope and limitations of the project specified?', a: '' },
    ],
    testing: [
      { id: uid(), q: 'Testing strategy followed (unit/integration/system)?', a: '' },
      { id: uid(), q: 'Test cases prepared and executed?', a: '' },
      { id: uid(), q: 'How many test cases passed?', a: '' },
      { id: uid(), q: 'Any major bugs identified and fixed?', a: '' },
      { id: uid(), q: 'Final validation / user acceptance completed?', a: '' },
    ],
  },
  summary_layout: {
    about: 'table',
    tools: 'table',
    design: 'table',
  },
  project_narrative: '',
  appendix: [{ id: uid(), term: '', definition: '' }],
  page_border_rules: {
    cover: true,
    certificate: true,
    acknowledgement: true,
    toc: true,
    abstract: true,
    abbreviations: true,
    figures: true,
    chapter_divider: true,
    chapter_content: true,
    references: true,
    project_summary: true,
    appendix: true,
  },
});

// ─── PDF Generator ───────────────────────────────────────────────────────────
export const createReportPDF = (d) => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const lm = 25.4, rm = 25.4;
  const usableW = W - lm - rm;
  const borders = d.page_border_rules || {};

  // Double border — used on ALL pages
  const border = () => {
    const outer = { x: 11.2, y: 11.2, w: W - 22.4, h: H - 22.4 };
    const inner = { x: 12.4, y: 12.4, w: W - 24.8, h: H - 24.8 };

    pdf.setDrawColor(0);
    pdf.setLineWidth(0.45);
    pdf.rect(outer.x, outer.y, outer.w, outer.h);
    pdf.setLineWidth(0.12);
    pdf.rect(inner.x, inner.y, inner.w, inner.h);
  };

  const drawBorderIf = (key) => {
    if (borders[key] !== false) border();
  };

  // Header code — only on chapter content pages, references, project summary, appendix
  const headerCode = (txt) => {
    pdf.setFontSize(8);
    pdf.setFont('times', 'normal');
    pdf.setTextColor(0);
    pdf.text(txt, lm, 10);
  };

  const justifiedText = (text, x, y, maxW, lineH) => {
    const lines = pdf.splitTextToSize(text, maxW);
    lines.forEach((line, idx) => {
      const isLast = idx === lines.length - 1;
      pdf.text(line, x, y, { maxWidth: maxW, align: isLast ? 'left' : 'justify' });
      y += lineH;
    });
    return y;
  };

  const justifiedBlock = (text, x, y, maxW, lineH) => {
    const lines = pdf.splitTextToSize(text || '', maxW);
    lines.forEach((line, idx) => {
      const isLast = idx === lines.length - 1;
      pdf.text(line, x, y, { maxWidth: maxW, align: isLast ? 'left' : 'justify' });
      y += lineH;
    });
    return y;
  };

  const drawManualJustifiedLine = (line, x, y, maxW, font = 'times', style = 'normal', size = 11, isLastLine = false) => {
    const words = String(line || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    pdf.setFont(font, style);
    pdf.setFontSize(size);
    if (isLastLine || words.length === 1) {
      pdf.text(words.join(' '), x, y);
      return;
    }
    const wordWidths = words.map((w) => pdf.getTextWidth(w));
    const wordsW = wordWidths.reduce((a, b) => a + b, 0);
    const gaps = words.length - 1;
    const gapW = (maxW - wordsW) / gaps;
    let cx = x;
    words.forEach((w, i) => {
      pdf.text(w, cx, y);
      cx += wordWidths[i] + (i < gaps ? gapW : 0);
    });
  };

  const drawStyledParagraph = (segments, x, y, maxW, lineH, baseFont = 'times', baseSize = 10.5) => {
    const styledWords = [];
    segments.forEach((seg) => {
      const words = String(seg.text || '').split(/\s+/).filter(Boolean);
      words.forEach((w) => styledWords.push({ word: w, style: seg.style || 'normal' }));
    });

    let line = [];
    let lineW = 0;
    const flush = (isLastLine = false) => {
      let cx = x;
      const gaps = Math.max(0, line.length - 1);
      const extra = !isLastLine && gaps > 0 ? Math.max(0, maxW - lineW) / gaps : 0;
      line.forEach((token, i) => {
        const isLastToken = i === line.length - 1;
        const txt = isLastToken ? token.word : `${token.word} `;
        pdf.setFont(baseFont, token.style);
        pdf.setFontSize(baseSize);
        pdf.text(txt, cx, y);
        cx += pdf.getTextWidth(txt) + (isLastToken ? 0 : extra);
      });
      y += lineH;
      line = [];
      lineW = 0;
    };

    styledWords.forEach((token) => {
      pdf.setFont(baseFont, token.style);
      pdf.setFontSize(baseSize);
      const w = pdf.getTextWidth(`${token.word} `);
      if (lineW + w > maxW && line.length) flush(false);
      line.push(token);
      lineW += w;
    });
    if (line.length) flush(true);
    return y;
  };

  // ── COVER PAGE ─────────────────────────────────────────────────────────────
  // Double border ONLY — no header code on cover
  drawBorderIf('cover');

  let y = 34;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(16);
  const titleLines = pdf.splitTextToSize((d.project_title || 'PROJECT TITLE').toUpperCase(), usableW);
  titleLines.forEach((l) => { pdf.text(l, W / 2, y, { align: 'center' }); y += 9; });

  y += 5;
  pdf.setFont('times', 'normal');
  pdf.setFontSize(12);
  pdf.text('A', W / 2, y, { align: 'center' }); y += 8;

  pdf.setFont('times', 'bold');
  pdf.setFontSize(14);
  pdf.text('MINOR PROJECT-I REPORT', W / 2, y, { align: 'center' }); y += 8;

  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  pdf.text('Submitted in partial fulfilment of the requirements', W / 2, y, { align: 'center' }); y += 6.5;
  pdf.text('for the degree of', W / 2, y, { align: 'center' }); y += 6.5;

  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  pdf.text(d.degree || 'BACHELOR OF TECHNOLOGY', W / 2, y, { align: 'center' }); y += 7;

  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  pdf.text('in', W / 2, y, { align: 'center' }); y += 6.5;

  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  pdf.text(d.branch || 'COMPUTER SCIENCE & ENGINEERING', W / 2, y, { align: 'center' }); y += 14;

  pdf.setFont('times', 'normal');
  pdf.setFontSize(12);
  pdf.text('By', W / 2, y, { align: 'center' }); y += 8;

  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  pdf.text(d.group_no || 'GROUP NO.', W / 2, y, { align: 'center' }); y += 9;

  pdf.setFont('times', 'bold');
  pdf.setFontSize(12);
  const visibleMembers = (d.members || []).filter((m) => m.name || m.enrollment);
  const rowW = 98;
  const rowStartX = (W - rowW) / 2;
  const nameW = 62;
  const enrW = rowW - nameW;
  visibleMembers.forEach((m) => {
    pdf.text(m.name || '', rowStartX + nameW / 2, y, { align: 'center', maxWidth: nameW - 2 });
    pdf.text(m.enrollment || '', rowStartX + nameW + enrW / 2, y, { align: 'center', maxWidth: enrW - 2 });
    y += 7.2;
  });

  y += 8;
  pdf.setFont('times', 'normal');
  pdf.setFontSize(12);
  pdf.text('Under the guidance of', W / 2, y, { align: 'center' }); y += 8;

  pdf.setFont('times', 'bold');
  pdf.setFontSize(12);
  pdf.text(d.guide_name || '', W / 2, y, { align: 'center' }); y += 7;

  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  pdf.text(`(${d.guide_designation || 'Associate Professor'})`, W / 2, y, { align: 'center' }); y += 10;

  const logoSize = 30;
  const logoX = W / 2 - logoSize / 2;
  if (d.logo_base64) {
    try {
      const fmt = d.logo_base64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(d.logo_base64, fmt, logoX, y, logoSize, logoSize);
      y += logoSize + 5;
    } catch (e) { y += 10; }
  } else {
    y += 10;
  }

  // Footer anchored from bottom — ALL bold, no separator line
  const fy = H - 54;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(12);
  pdf.text(d.department || 'Department of Computer Science & Engineering', W / 2, fy, { align: 'center' });
  pdf.text(d.institute || 'Sagar Institute of Science & Technology (SISTec), Bhopal (M.P)', W / 2, fy + 8, { align: 'center', maxWidth: usableW });
  pdf.setFontSize(10);
  pdf.text('Approved by AICTE, New Delhi & Govt. of M.P.', W / 2, fy + 16, { align: 'center' });
  pdf.text('Affiliated to Rajiv Gandhi Proudyogiki Vishwavidyalaya, Bhopal (M.P.)', W / 2, fy + 22, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text(d.submission_month_year || 'December – 2025', W / 2, H - 22, { align: 'center' });

  // ── CERTIFICATE PAGE ───────────────────────────────────────────────────────
  // Double border ONLY — no header code; institute name written inside content
  pdf.addPage();
  drawBorderIf('certificate');
  y = 28;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(11.5);
  pdf.text(d.institute || 'Sagar Institute of Science & Technology (SISTec),Bhopal (M.P)', W / 2, y, { align: 'center', maxWidth: usableW }); y += 7;
  pdf.setFontSize(10.5);
  pdf.text(d.department || 'Department of Computer Science & Engineering', W / 2, y, { align: 'center' }); y += 9;

  if (d.logo_base64) {
    try {
      const fmt = d.logo_base64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(d.logo_base64, fmt, W / 2 - 14, y, 28, 28);
    } catch (e) {}
    y += 34;
  } else { y += 10; }

  pdf.setFont('times', 'bolditalic');
  pdf.setFontSize(13);
  pdf.text('CERTIFICATE', W / 2, y, { align: 'center' }); y += 12;

  pdf.setFont('times', 'normal');
  pdf.setFontSize(10.5);
  y = drawStyledParagraph([
    { text: 'We hereby certify that the work which is being presented in the B.Tech. Minor Project-I Report entitled', style: 'normal' },
    { text: ` ${d.project_title || '[Project Title]'}, `, style: 'bold' },
    { text: 'in partial fulfilment of the requirements for the award of the degree of', style: 'normal' },
    { text: ' Bachelor of Technology, ', style: 'bolditalic' },
    { text: 'submitted to the', style: 'normal' },
    { text: ` ${d.department || 'Department of Computer Science & Engineering'}, `, style: 'bold' },
    { text: `${d.institute || 'SISTec, Bhopal (M.P.)'} `, style: 'normal' },
    { text: 'is an authentic record of our own work carried out during the period from', style: 'normal' },
    { text: ` ${d.certificate_period || 'Jul-2025 to Dec-2025'} `, style: 'normal' },
    { text: 'under the supervision of', style: 'normal' },
    { text: ` ${d.guide_name || '[Guide Name]'}.`, style: 'bold' },
  ], lm, y, usableW, 6.1);
  y += 8;
  y = justifiedText('The content presented in this project has not been submitted by me for the award of any other degree elsewhere.', lm, y, usableW, 6.1); y += 18;

  const mems = (d.members || []).filter((m) => m.name || m.enrollment);
  const maxCols = 4;
  if (mems.length > 0) {
    const rowH = 9;
    const rowGap = 4;
    let rowStartY = y;
    for (let start = 0; start < mems.length; start += maxCols) {
      const rowMembers = mems.slice(start, start + maxCols);
      const cols = rowMembers.length;
      const colW = usableW / cols;
      for (let ci = 0; ci < cols; ci++) {
        const cx = lm + ci * colW;
        const m = rowMembers[ci] || {};
        pdf.setFont('times', 'bold');
        pdf.setFontSize(8.5);
        pdf.text(m.name || '', cx + colW / 2, rowStartY + 5.8, { align: 'center', maxWidth: colW - 3 });
        pdf.text(m.enrollment || '', cx + colW / 2, rowStartY + rowH + 5.8, { align: 'center', maxWidth: colW - 3 });
      }
      rowStartY += rowH * 2 + rowGap;
    }
    y = rowStartY + 12;
  }

  pdf.setFont('times', 'normal');
  pdf.setFontSize(10.5);
  y = justifiedText('This is to certify that the above statement made by the candidate is correct to the best of my knowledge.', lm, y, usableW, 6.1);
  y += 6;
  pdf.setFont('times', 'bolditalic');
  pdf.text('Date:', lm, y); y += 22;

  const sigW = usableW / 3;
  [
    { name: d.guide_name || 'Dr Komal Tahiliani', role: 'Project Guide' },
    { name: d.hod_name || 'Prof. Nargish Gupta', role: 'HOD, CSE' },
    { name: d.principal_name || 'Dr. Manish Billore', role: 'Principal' },
  ].forEach((s, i) => {
    const sx = lm + i * sigW + sigW / 2;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(8.5);
    pdf.text(s.name, sx, y, { align: 'center' });
    pdf.setFont('times', 'bold');
    pdf.setFontSize(8.5);
    pdf.text(s.role, sx, y + 5.5, { align: 'center' });
  });

  // ── ACKNOWLEDGEMENT ────────────────────────────────────────────────────────
  // Double border ONLY — no header code
  pdf.addPage();
  drawBorderIf('acknowledgement');
  y = 35;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(14);
  pdf.text('ACKNOWLEDGEMENT', W / 2, y, { align: 'center' }); y += 18;

  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  y = drawStyledParagraph([
    { text: 'We would like to express our sincere thanks ' },
    { text: 'Dr. Manish Billore', style: 'bold' },
    { text: ', Principal, SISTec and ' },
    { text: 'Dr. Swati Saxena', style: 'bold' },
    { text: ', Vice Principal SISTec Gandhi Nagar, Bhopal for giving us an opportunity to undertake this project.' },
  ], lm, y, usableW, 6.5, 'times', 11); y += 8;
  y = drawStyledParagraph([
    { text: 'We also take this opportunity to express a deep sense of gratitude to ' },
    { text: `${d.hod_name || 'Prof. Nargish Gupta'}`, style: 'bold' },
    { text: ', HOD, Department of Computer Science & Engineering for his kindhearted support' },
  ], lm, y, usableW, 6.5, 'times', 11); y += 8;
  y = drawStyledParagraph([
    { text: 'We extend our sincere and heartfelt thanks to our guide, ' },
    { text: `${d.guide_name || '[Guide Name]'}`, style: 'bold' },
    { text: ', for providing us with the right guidance and advice at crucial junctures and for showing us the right way.' },
  ], lm, y, usableW, 6.5, 'times', 11); y += 8;
  y = drawStyledParagraph([
    { text: 'I am thankful to the Project Coordinator, ' },
    { text: `${d.project_coordinator || 'Prof. Mayank Kurchaniya'}`, style: 'bold' },
    { text: ', who devoted his precious time in giving us the information about various aspects and gave support and guidance at every point of time.' },
  ], lm, y, usableW, 6.5, 'times', 11); y += 8;
  y = justifiedText(`I would like to thank all those people who helped me directly or indirectly to complete my project whenever I found myself in any issue.`, lm, y, usableW, 6.5);

  // ── TABLE OF CONTENTS ──────────────────────────────────────────────────────
  // Double border ONLY — no header code
  pdf.addPage();
  drawBorderIf('toc');
  y = 30;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(14);
  pdf.text('TABLE OF CONTENTS', W / 2, y, { align: 'center' }); y += 14;
  pdf.setFontSize(11);
  pdf.text('TITLE', lm, y);
  pdf.text('PAGE NO.', W - rm, y, { align: 'right' }); y += 8;
  pdf.setFont('times', 'normal');
  const tocRows = [
    { title: 'Abstract', page: 'i' },
    { title: 'List of Abbreviation', page: 'ii' },
    { title: 'List of Figures', page: 'iii' },
    ...(d.chapters || []).flatMap((ch, i) => {
      const safeChapterNo = Number(ch.number) > 0 ? Number(ch.number) : i + 1;
      return ([
      {
        kind: 'chapter',
        chapterNo: `Chapter ${safeChapterNo}`,
        title: `${ch.title || ''}`.trim(),
        page: String(ch.toc_page || i + 1),
      },
      ...((ch.sections || []).map((s, si) => ({
        kind: 'section',
        code: `${s.code || `${safeChapterNo}.${si + 1}`}`.trim(),
        title: `${(s.heading || '').replace(/^\d+\.\d+\s+/, '')}`.trim(),
        page: String(s.toc_page || ch.toc_page || i + 1),
      }))),
    ]);
    }),
    { title: 'References', page: '' },
    { title: 'Project Summary', page: '' },
    { title: 'Appendix1: Glossary of Terms', page: '' },
  ];

  const chapterColX = lm + 2;
  const titleX = lm + 34;
  const secCodeX = lm + 38;
  const secTitleX = lm + 54;

  tocRows.forEach((e) => {
    if (y > H - 30) { pdf.addPage(); drawBorderIf('toc'); y = 30; }

    if (e.kind === 'chapter') {
      pdf.text(e.chapterNo || '', chapterColX, y);
      const chLines = pdf.splitTextToSize(e.title || '', W - rm - titleX - 8);
      chLines.forEach((cl, idx) => {
        if (idx > 0) {
          y += 6.2;
          if (y > H - 30) { pdf.addPage(); drawBorderIf('toc'); y = 30; }
        }
        pdf.text(cl, titleX, y);
      });
    } else if (e.kind === 'section') {
      pdf.text(e.code || '', secCodeX, y);
      const sLines = pdf.splitTextToSize(e.title || '', W - rm - secTitleX - 8);
      sLines.forEach((sl, idx) => {
        if (idx > 0) {
          y += 6.2;
          if (y > H - 30) { pdf.addPage(); drawBorderIf('toc'); y = 30; }
        }
        pdf.text(sl, secTitleX, y);
      });
    } else {
      pdf.text(e.title, lm, y);
    }

    if (e.page) pdf.text(e.page, W - rm, y, { align: 'right' });
    y += 7.4;
  });

  // ── ABSTRACT ───────────────────────────────────────────────────────────────
  // Double border ONLY — no header code; roman page number at bottom
  pdf.addPage();
  drawBorderIf('abstract');
  y = 30;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(14);
  pdf.text('ABSTRACT', W / 2, y, { align: 'center' }); y += 10;
  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  const absParagraphs = String(d.abstract || '')
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!absParagraphs.length) {
    const absLines = pdf.splitTextToSize('', usableW);
    absLines.forEach((l) => {
      if (y > H - 22) { pdf.addPage(); drawBorderIf('abstract'); y = 30; }
      pdf.text(l, lm, y, { maxWidth: usableW }); y += 6.5;
    });
  } else {
    absParagraphs.forEach((para) => {
      const absLines = pdf.splitTextToSize(para, usableW);
      absLines.forEach((l, idx) => {
        if (y > H - 22) { pdf.addPage(); drawBorderIf('abstract'); y = 30; }
        const isLast = idx === absLines.length - 1;
        drawManualJustifiedLine(l, lm, y, usableW, 'times', 'normal', 11, isLast);
        y += 6.5;
      });
      y += 2;
    });
  }
  pdf.setFontSize(10);
  pdf.text('i', W / 2, H - 16, { align: 'center' });

  // ── LIST OF ABBREVIATIONS ──────────────────────────────────────────────────
  // Double border ONLY — no header code; roman page number at bottom
  pdf.addPage();
  drawBorderIf('abbreviations');
  y = 30;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(14);
  pdf.text('LIST OF ABBREVIATIONS', W / 2, y, { align: 'center' }); y += 12;
  pdf.setFontSize(11);
  pdf.text('Abbreviation', lm, y);
  pdf.text('Description', lm + 50, y); y += 8;
  pdf.setFont('times', 'normal');
  (d.abbreviations || []).forEach((a) => {
    if (!a.abbr && !a.desc) return;
    if (y > H - 22) { pdf.addPage(); drawBorderIf('abbreviations'); y = 30; }
    pdf.text(a.abbr || '', lm, y);
    const dLines = pdf.splitTextToSize(a.desc || '', usableW - 52);
    dLines.forEach((dl, di) => { pdf.text(dl, lm + 50, y + di * 6); });
    y += Math.max(dLines.length, 1) * 6 + 2;
  });
  pdf.setFontSize(10);
  pdf.text('ii', W / 2, H - 16, { align: 'center' });

  // ── LIST OF FIGURES ────────────────────────────────────────────────────────
  // Double border ONLY — no header code; roman page number at bottom
  pdf.addPage();
  drawBorderIf('figures');
  y = 30;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(14);
  pdf.text('LIST OF FIGURES', W / 2, y, { align: 'center' }); y += 12;
  pdf.setFontSize(11);
  pdf.text('Figure No.', lm, y);
  pdf.text('Title', lm + 42, y);
  pdf.text('Page No.', W - rm, y, { align: 'right' }); y += 8;
  pdf.setFont('times', 'normal');
  (d.figures || []).forEach((f) => {
    if (!f.title) return;
    if (y > H - 22) { pdf.addPage(); drawBorderIf('figures'); y = 30; }
    pdf.text(f.fig_no || '', lm, y);
    pdf.text(':', lm + 36, y);
    pdf.text(f.title || '', lm + 42, y);
    pdf.text(f.page_no || '', W - rm, y, { align: 'right' }); y += 8;
  });
  pdf.setFontSize(10);
  pdf.text('iii', W / 2, H - 16, { align: 'center' });

  // ── CHAPTERS ───────────────────────────────────────────────────────────────
  // Divider pages: double border ONLY
  // Content pages: double border + header code at top-left
  const hdrCode = `SISTec/BTech/CS/${new Date().getFullYear()}/5/MinorProject_I/${(d.group_no || '').replace(/\D/g, '')}`;
  let chPageNum = 1;
  (d.chapters || []).forEach((ch, ci) => {
    // Chapter divider — double border ONLY, no header code
    pdf.addPage();
    drawBorderIf('chapter_divider');
    pdf.setFont('times', 'bold');
    pdf.setFontSize(30);
    pdf.text(`Chapter ${ch.number || ci + 1}`, W / 2, H / 2 - 15, { align: 'center' });
    pdf.text(ch.title || '', W / 2, H / 2 + 10, { align: 'center' });

    // Chapter content — double border + header code
    pdf.addPage();
    drawBorderIf('chapter_content');
    headerCode(hdrCode);
    y = 26;
    pdf.setFont('times', ch.title_bold === false ? 'normal' : 'bold');
    pdf.setFontSize(Number(ch.title_size) || 17);
    pdf.text(`CHAPTER  ${ch.number || ci + 1}`, W - rm, y, { align: 'right' }); y += 9;
    pdf.text((ch.title || '').toUpperCase(), W - rm, y, { align: 'right' }); y += 3;
    pdf.setLineWidth(0.6);
    pdf.line(lm, y, W - rm, y); y += 10;
    const parseBoldSegments = (text) => {
      const segs = [];
      const rx = /\*\*(.+?)\*\*/g;
      let last = 0;
      let m;
      while ((m = rx.exec(text || '')) !== null) {
        if (m.index > last) segs.push({ text: text.slice(last, m.index), style: 'normal' });
        segs.push({ text: m[1], style: 'bold' });
        last = m.index + m[0].length;
      }
      if (last < (text || '').length) segs.push({ text: text.slice(last), style: 'normal' });
      return segs.length ? segs : [{ text: text || '', style: 'normal' }];
    };

    const drawMarkdownParagraphWithPagination = (paraText, fontSize) => {
      const renderSingleParagraph = (text) => {
        const hasMarkdownBold = /\*\*(.+?)\*\*/.test(text || '');
        if (!hasMarkdownBold) {
          pdf.setFont('times', 'normal');
          pdf.setFontSize(fontSize);
          const lines = pdf.splitTextToSize(text || '', usableW);
          lines.forEach((l, idx) => {
            if (y > H - 22) { pdf.addPage(); drawBorderIf('chapter_content'); headerCode(hdrCode); y = 26; }
            const isLast = idx === lines.length - 1;
            drawManualJustifiedLine(l, lm, y, usableW, 'times', 'normal', fontSize, isLast);
            y += 6.5;
          });
          return;
        }

        const segments = parseBoldSegments(text || '');
        const tokens = [];
        segments.forEach((seg) => {
          seg.text.split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ word: w, style: seg.style }));
        });
        let line = [];
        let lineW = 0;
        const flush = (isLastLine = false) => {
          if (y > H - 22) { pdf.addPage(); drawBorderIf('chapter_content'); headerCode(hdrCode); y = 26; }
          let cx = lm;
          const gaps = Math.max(0, line.length - 1);
          const extra = !isLastLine && gaps > 0 ? Math.max(0, usableW - lineW) / gaps : 0;
          line.forEach((t, i) => {
            const isLastToken = i === line.length - 1;
            const txt = isLastToken ? t.word : `${t.word} `;
            pdf.setFont('times', t.style === 'bold' ? 'bold' : 'normal');
            pdf.setFontSize(fontSize);
            pdf.text(txt, cx, y);
            cx += pdf.getTextWidth(txt) + (isLastToken ? 0 : extra);
          });
          y += 6.5;
          line = [];
          lineW = 0;
        };
        tokens.forEach((t) => {
          pdf.setFont('times', t.style === 'bold' ? 'bold' : 'normal');
          pdf.setFontSize(fontSize);
          const w = pdf.getTextWidth(`${t.word} `);
          if (lineW + w > usableW && line.length) flush(false);
          line.push(t);
          lineW += w;
        });
        if (line.length) flush(true);
      };

      const blocks = String(paraText || '').split('\n');
      blocks.forEach((blk, idx) => {
        const clean = blk.trim();
        if (!clean) {
          y += 6.5;
        } else {
          renderSingleParagraph(clean);
        }
        if (idx < blocks.length - 1) y += 1.5;
      });
    };

    const chapterContentSize = Number(ch.content_size) || 11;
    drawMarkdownParagraphWithPagination(ch.content || '', chapterContentSize);
    y += 4;

    (ch.sections || []).forEach((sec) => {
      if (!sec?.heading && !sec?.content) return;
      if (y > H - 30) { pdf.addPage(); drawBorderIf('chapter_content'); headerCode(hdrCode); y = 26; }
      if (sec?.heading) {
        pdf.setFont('times', 'bold');
        pdf.setFontSize(Number(ch.subheading_size) || 13);
        pdf.text(sec.heading, lm, y, { maxWidth: usableW });
        y += 7;
      }
      drawMarkdownParagraphWithPagination(sec?.content || '', chapterContentSize);
      y += 4;
    });
    pdf.setFontSize(10);
    pdf.text(String(chPageNum++), W / 2, H - 16, { align: 'center' });
  });

  // ── REFERENCES ─────────────────────────────────────────────────────────────
  // Double border + header code
  pdf.addPage();
  drawBorderIf('references');
  headerCode(hdrCode);
  y = 28;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(18);
  pdf.text('REFERENCES', W - rm, y, { align: 'right' }); y += 3;
  pdf.setLineWidth(0.6);
  pdf.line(lm, y, W - rm, y); y += 10;
  const journals = (d.ref_journals || []).filter((r) => r.text);
  const websites = (d.ref_websites || []).filter((r) => r.text);
  if (journals.length) {
    pdf.setFont('times', 'bold'); pdf.setFontSize(12);
    pdf.text('JOURNALS / RESEARCH PAPERS', lm, y); y += 8;
    pdf.setFont('times', 'normal'); pdf.setFontSize(11);
    journals.forEach((r, i) => {
      const lines = pdf.splitTextToSize(`[${i + 1}]. ${r.text}`, usableW);
      lines.forEach((l, idx) => {
        const isLast = idx === lines.length - 1;
        pdf.text(l, lm, y, { maxWidth: usableW, align: isLast ? 'left' : 'justify' });
        y += 6.5;
      }); y += 2;
    }); y += 4;
  }
  if (websites.length) {
    pdf.setFont('times', 'bold'); pdf.setFontSize(12);
    pdf.text('WEBSITES', lm, y); y += 8;
    pdf.setFont('times', 'normal'); pdf.setFontSize(11);
    websites.forEach((r, i) => {
      const lines = pdf.splitTextToSize(`[${journals.length + i + 1}]. ${r.text}`, usableW);
      lines.forEach((l, idx) => {
        const isLast = idx === lines.length - 1;
        pdf.text(l, lm, y, { maxWidth: usableW, align: isLast ? 'left' : 'justify' });
        y += 6.5;
      }); y += 2;
    });
  }

  // ── PROJECT SUMMARY ────────────────────────────────────────────────────────
  // Double border + header code
  pdf.addPage();
  drawBorderIf('project_summary');
  headerCode(hdrCode);
  y = 28;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(17);
  pdf.text('PROJECT SUMMARY', W - rm, y, { align: 'right' }); y += 3;
  pdf.setLineWidth(0.6);
  pdf.line(lm, y, W - rm, y); y += 10;

  const drawSumSection = (title, rows) => {
    if (y > H - 40) { pdf.addPage(); drawBorderIf('project_summary'); headerCode(hdrCode); y = 28; }
    pdf.setFont('times', 'bolditalic'); pdf.setFontSize(12);
    pdf.text(title, lm, y); y += 2;
    pdf.setLineWidth(0.3);
    pdf.line(lm, y, lm + pdf.getTextWidth(title), y); y += 6;
    const qW = 65, aW = usableW - qW - 2;
    rows.forEach((row) => {
      if (y > H - 25) { pdf.addPage(); drawBorderIf('project_summary'); headerCode(hdrCode); y = 28; }
      const qLines = pdf.splitTextToSize(row.q || '', qW - 4);
      const aLines = pdf.splitTextToSize(row.a || '', aW - 4);
      const rH = Math.max(qLines.length, aLines.length, 1) * 6 + 4;
      pdf.setLineWidth(0.3);
      pdf.rect(lm, y - 4, qW, rH);
      pdf.rect(lm + qW, y - 4, aW, rH);
      pdf.setFont('times', 'bold'); pdf.setFontSize(10);
      qLines.forEach((l, i) => pdf.text(l, lm + 2, y + i * 6));
      pdf.setFont('times', 'normal');
      aLines.forEach((l, i) => pdf.text(l, lm + qW + 2, y + i * 6));
      y += rH + 2;
    }); y += 6;
  };

  const drawSumSectionPlain = (title, rows) => {
    if (y > H - 40) { pdf.addPage(); drawBorderIf('project_summary'); headerCode(hdrCode); y = 28; }
    pdf.setFont('times', 'bolditalic'); pdf.setFontSize(12);
    pdf.text(title, lm, y); y += 2;
    pdf.setLineWidth(0.3);
    pdf.line(lm, y, lm + pdf.getTextWidth(title), y); y += 7;
    pdf.setFont('times', 'normal'); pdf.setFontSize(10.5);
    rows.forEach((row, i) => {
      if (y > H - 28) { pdf.addPage(); drawBorderIf('project_summary'); headerCode(hdrCode); y = 28; }
      const line = `${i + 1}. ${row.q || ''}${row.a ? `: ${row.a}` : ''}`;
      const lines = pdf.splitTextToSize(line, usableW);
      lines.forEach((l) => {
        if (y > H - 22) { pdf.addPage(); drawBorderIf('project_summary'); headerCode(hdrCode); y = 28; }
        pdf.text(l, lm, y, { maxWidth: usableW });
        y += 6;
      });
      y += 1.5;
    });
    y += 5;
  };

  const ps = d.project_summary || {};
  const summaryLayout = d.summary_layout || {};
  const summarySections = [
    { key: 'about', title: 'About Project' },
    { key: 'tools', title: 'Tools & Technologies' },
    { key: 'design', title: 'Software Design & Coding' },
    { key: 'requirements', title: 'Project Requirements' },
    { key: 'testing', title: 'Testing' },
  ];
  summarySections.forEach((sec) => {
    const rows = ps[sec.key] || [];
    if (!rows.length) return;
    (summaryLayout[sec.key] === 'text' ? drawSumSectionPlain : drawSumSection)(sec.title, rows);
  });
  drawSumSection('Project Requirements', ps.requirements || []);
  drawSumSection('Testing', ps.testing || []);

  if (y > H - 60) { pdf.addPage(); drawBorderIf('project_summary'); headerCode(hdrCode); y = 28; }
  pdf.setFont('times', 'bolditalic'); pdf.setFontSize(12);
  pdf.text('Write project narrative covering above mentioned points', lm, y); y += 2;
  pdf.setLineWidth(0.3);
  pdf.line(lm, y, W - rm, y); y += 8;
  const narLines = pdf.splitTextToSize(d.project_narrative || '', usableW - 8);
  const narH = Math.max(narLines.length * 6.5 + 12, 40);
  pdf.setLineWidth(0.4);
  pdf.rect(lm, y - 4, usableW, narH);
  pdf.setFont('times', 'normal'); pdf.setFontSize(11);
  narLines.forEach((l, idx) => {
    const isLast = idx === narLines.length - 1;
    pdf.text(l, lm + 4, y, { maxWidth: usableW - 8, align: isLast ? 'left' : 'justify' });
    y += 6.5;
  });
  y += narH - narLines.length * 6.5 + 14;

  if (y > H - 50) { pdf.addPage(); drawBorderIf('project_summary'); headerCode(hdrCode); y = 28; }
  pdf.setFont('times', 'normal'); pdf.setFontSize(11);
  (d.members || []).forEach((m) => {
    pdf.text(m.name || '', lm, y);
    pdf.text(m.enrollment || '', lm + 50, y); y += 7;
  });
  const sigY = y - (d.members || []).length * 7 + 4;
  pdf.text('Guide Signature', W - rm - 38, sigY);
  pdf.text(`(${d.guide_name || 'Guide Name'})`, W - rm - 38, sigY + 7);

  // ── APPENDIX ───────────────────────────────────────────────────────────────
  // Double border + header code
  pdf.addPage();
  drawBorderIf('appendix');
  headerCode(hdrCode);
  y = 28;
  pdf.setFont('times', 'bold'); pdf.setFontSize(15);
  pdf.text('APPENDIX-1', lm, y);
  pdf.text('GLOSSARY OF TERMS', W - rm, y, { align: 'right' }); y += 2;
  pdf.setLineWidth(0.5);
  pdf.line(lm, y, W - rm, y); y += 10;
  pdf.setFontSize(11);
  pdf.text('(In alphabetical order)', lm, y); y += 12;

  const groups = {};
  (d.appendix || []).filter((a) => a.term || a.definition).forEach((a) => {
    const L = (a.term || '?')[0].toUpperCase();
    if (!groups[L]) groups[L] = [];
    groups[L].push(a);
  });
  Object.keys(groups).sort().forEach((letter) => {
    if (y > H - 40) { pdf.addPage(); drawBorderIf('appendix'); headerCode(hdrCode); y = 28; }
    pdf.setFont('times', 'bold'); pdf.setFontSize(18);
    pdf.text(letter, lm, y); y += 9;
    groups[letter].forEach((a) => {
      if (y > H - 30) { pdf.addPage(); drawBorderIf('appendix'); headerCode(hdrCode); y = 28; }
      pdf.setFont('times', 'bold'); pdf.setFontSize(11);
      pdf.text(a.term || '', lm, y); y += 6;
      pdf.setFont('times', 'normal');
      const defLines = pdf.splitTextToSize(a.definition || '', usableW - 20);
      defLines.forEach((l, idx) => {
        const isLast = idx === defLines.length - 1;
        pdf.text(l, lm + 20, y, { maxWidth: usableW - 20, align: isLast ? 'left' : 'justify' });
        y += 6;
      }); y += 4;
    });
  });

  return pdf;
};

const saveBlobWithPrompt = async (blob, suggestedName, mimeType) => {
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'Document', accept: { [mimeType]: [`.${suggestedName.split('.').pop()}`] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

const generatePDF = async (d) => {
  const pdf = createReportPDF(d);
  const blob = pdf.output('blob');
  await saveBlobWithPrompt(blob, 'minor-project-report.pdf', 'application/pdf');
};

const applyBoldShortcut = (e, onChange) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b') return;
  e.preventDefault();
  const t = e.currentTarget;
  const s = t.selectionStart ?? 0;
  const ed = t.selectionEnd ?? 0;
  const val = t.value || '';
  const selected = val.slice(s, ed);
  const replacement = `**${selected || 'bold text'}**`;
  const next = val.slice(0, s) + replacement + val.slice(ed);
  onChange(next);
  requestAnimationFrame(() => {
    const cursorStart = s + 2;
    const cursorEnd = s + replacement.length - 2;
    t.focus();
    t.setSelectionRange(cursorStart, cursorEnd);
  });
};

// ─── Live Cover Preview ───────────────────────────────────────────────────────
const CoverPreview = ({ data }) => {
  const d = data || {};
  return (
    <div className="relative bg-white shadow-2xl mx-auto overflow-hidden"
      style={{ width: 300, height: 424, border: '2.5px solid #000', boxSizing: 'border-box' }}>
      {/* Inner border */}
      <div style={{ position: 'absolute', inset: 5, border: '1px solid #000', pointerEvents: 'none', zIndex: 1 }} />

      {/* Content — NO top header box on cover */}
      <div style={{
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: 10,
        color: '#000',
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '30px 22px 68px',
        zIndex: 2,
      }}>
        <div style={{ fontWeight: 'bold', fontSize: 13, lineHeight: 1.25, textAlign: 'center', marginBottom: 6 }}>
          {(d.project_title || 'PROJECT TITLE').toUpperCase()}
        </div>
        <div style={{ fontSize: 10, marginBottom: 2 }}>A</div>
        <div style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 4 }}>MINOR PROJECT-I REPORT</div>
        <div style={{ fontSize: 8.5, textAlign: 'center', lineHeight: 1.5, marginBottom: 6 }}>
          Submitted in partial fulfilment of the requirements<br />
          for the degree of<br />
          <strong style={{ fontSize: 10 }}>{d.degree || 'BACHELOR OF TECHNOLOGY'}</strong><br />
          in<br />
          <strong style={{ fontSize: 10 }}>{d.branch || 'COMPUTER SCIENCE & ENGINEERING'}</strong>
        </div>
        <div style={{ fontSize: 9, marginBottom: 2 }}>By</div>
        <div style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 5 }}>{d.group_no || 'GROUP NO.'}</div>
        <div style={{ width: '100%', marginBottom: 6 }}>
          {(d.members || []).filter(m => m.name || m.enrollment).map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'center', fontWeight: 'bold', fontSize: 9, lineHeight: 1.6 }}>
              <span style={{ width: 132, textAlign: 'center' }}>{m.name}</span>
              <span style={{ width: 104, textAlign: 'center' }}>{m.enrollment}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, marginBottom: 2 }}>Under the guidance of</div>
        <div style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 2 }}>{d.guide_name || 'Guide Name'}</div>
        <div style={{ fontSize: 8.5, marginBottom: 6 }}>({d.guide_designation || 'Associate Professor'})</div>
        {d.logo_base64 ? (
          <img src={d.logo_base64} alt="logo" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        ) : (
          <div style={{ width: 48, height: 48, border: '1.5px dashed #ccc', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 7, color: '#bbb', textAlign: 'center' }}>Logo<br />here</span>
          </div>
        )}
      </div>

      {/* Footer — all bold, no top separator line */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        fontFamily: '"Times New Roman", Times, serif',
        textAlign: 'center',
        padding: '6px 12px 10px',
        zIndex: 3,
      }}>
        <div style={{ fontWeight: 'bold', fontSize: 8 }}>{d.department || 'Department of Computer Science & Engineering'}</div>
        <div style={{ fontWeight: 'bold', fontSize: 7.5 }}>{d.institute || 'Sagar Institute of Science & Technology (SISTec), Bhopal (M.P)'}</div>
        <div style={{ fontWeight: 'bold', fontSize: 7 }}>Approved by AICTE, New Delhi &amp; Govt. of M.P.</div>
        <div style={{ fontWeight: 'bold', fontSize: 6.5 }}>Affiliated to Rajiv Gandhi Proudyogiki Vishwavidyalaya, Bhopal (M.P.)</div>
        <div style={{ fontWeight: 'bold', fontSize: 8.5, marginTop: 3 }}>{d.submission_month_year || 'December – 2025'}</div>
      </div>
    </div>
  );
};

// ─── SLIDES CONFIG ────────────────────────────────────────────────────────────
const SLIDES = [
  { id: 'cover', label: 'Cover', icon: FileText },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'guide', label: 'Guide & Institute', icon: GraduationCap },
  { id: 'abstract', label: 'Abstract', icon: AlignLeft },
  { id: 'abbrev', label: 'Abbreviations', icon: List },
  { id: 'figures', label: 'List of Figures', icon: Layers },
  { id: 'chapters', label: 'Chapters', icon: BookOpen },
  { id: 'references', label: 'References', icon: AlignLeft },
  { id: 'summary', label: 'Project Summary', icon: Layers },
  { id: 'appendix', label: 'Appendix', icon: List },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const TemplateLockReport = () => {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);
  const [activeChapter, setActiveChapter] = useState(0);
  const [activeSumSection, setActiveSumSection] = useState('about');
  const [newFigureTitle, setNewFigureTitle] = useState('');
  const [tocPasteText, setTocPasteText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // ─── FIX: hidden file input rendered always in DOM, ref attached directly ──
  const logoInputRef = useRef(null);
  const initialDataLoadedRef = useRef(false);
  const autoSaveTimerRef = useRef(null);

  useEffect(() => {
    reportAPI.getTemplateLock()
      .then((res) => {
        const raw = res.data?.data || {};
        if (!raw.members && raw.student_1_name) {
          raw.members = [];
          for (let i = 1; i <= 6; i++) {
            if (raw[`student_${i}_name`]) raw.members.push({ id: uid(), name: raw[`student_${i}_name`], enrollment: raw[`student_${i}_enrollment`] || '' });
          }
        }
        const def = defaultData();
        setData({
          ...def,
          ...raw,
          members: raw.members || def.members,
          chapters: (raw.chapters || def.chapters).map((ch, i) => ({
            id: ch.id || uid(),
            number: ch.number || i + 1,
            title: ch.title || '',
            toc_page: ch.toc_page ?? String(i + 1),
            title_size: ch.title_size ?? 17,
            title_bold: ch.title_bold ?? true,
            subheading_size: ch.subheading_size ?? 13,
            content_size: ch.content_size ?? 11,
            content: ch.content || '',
            sections: (ch.sections || [{ id: uid(), heading: '', content: '' }]).map((s) => ({
              id: s.id || uid(),
              code: s.code || '',
              heading: s.heading || '',
              toc_page: s.toc_page || '',
              content: s.content || '',
            })),
          })),
          project_summary: {
            ...def.project_summary,
            ...(raw.project_summary || {}),
          },
          page_border_rules: {
            ...def.page_border_rules,
            ...(raw.page_border_rules || {}),
          },
        });
      })
      .catch(() => { setData(defaultData()); toast.error('Could not load saved data'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!data) return;
    if (!initialDataLoadedRef.current) {
      initialDataLoadedRef.current = true;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setAutoSaving(true);
        setAutoSaveError('');
        await reportAPI.saveTemplateLock(data);
        setLastSavedAt(new Date().toLocaleTimeString());
      } catch {
        setAutoSaveError('Auto-save failed');
      } finally {
        setAutoSaving(false);
      }
    }, 1200);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [data]);

  const set = (k, v) => setData((p) => ({ ...p, [k]: v }));
  const setMember = (idx, k, v) => setData((p) => ({ ...p, members: p.members.map((m, i) => i === idx ? { ...m, [k]: v } : m) }));
  const addMember = () => setData((p) => ({ ...p, members: [...p.members, { id: uid(), name: '', enrollment: '' }] }));
  const removeMember = (idx) => setData((p) => ({ ...p, members: p.members.filter((_, i) => i !== idx) }));

  const setAbbr = (idx, k, v) => setData((p) => ({ ...p, abbreviations: p.abbreviations.map((a, i) => i === idx ? { ...a, [k]: v } : a) }));
  const addAbbr = () => setData((p) => ({ ...p, abbreviations: [...(p.abbreviations || []), { id: uid(), abbr: '', desc: '' }] }));
  const removeAbbr = (idx) => setData((p) => ({ ...p, abbreviations: p.abbreviations.filter((_, i) => i !== idx) }));

  const setFig = (idx, k, v) => setData((p) => ({ ...p, figures: p.figures.map((f, i) => i === idx ? { ...f, [k]: v } : f) }));
  const addFig = () => setData((p) => ({ ...p, figures: [...(p.figures || []), { id: uid(), fig_no: `Figure ${(p.figures || []).length + 1}.1`, title: '', page_no: '' }] }));
  const removeFig = (idx) => setData((p) => ({ ...p, figures: p.figures.filter((_, i) => i !== idx) }));

  const setChapter = (idx, k, v) => setData((p) => ({ ...p, chapters: p.chapters.map((c, i) => i === idx ? { ...c, [k]: v } : c) }));
  const addChapter = () => setData((p) => {
    const num = (p.chapters || []).length + 1;
    return {
      ...p,
      chapters: [...(p.chapters || []), {
        id: uid(),
        number: num,
        title: '',
        toc_page: String(num),
        title_size: 17,
        title_bold: true,
        subheading_size: 13,
        content_size: 11,
        content: '',
        sections: [{ id: uid(), code: `${num}.1`, heading: '', toc_page: String(num), content: '' }],
      }],
    };
  });
  const removeChapter = (idx) => setData((p) => ({ ...p, chapters: p.chapters.filter((_, i) => i !== idx) }));
  const addChapterSection = (idx) => setData((p) => ({
    ...p,
    chapters: p.chapters.map((c, i) => i === idx
      ? {
          ...c,
          sections: [
            ...(c.sections || []),
            {
              id: uid(),
              code: `${c.number || idx + 1}.${(c.sections || []).length + 1}`,
              heading: '',
              toc_page: String(c.toc_page || c.number || idx + 1),
              content: '',
            },
          ],
        }
      : c),
  }));
  const setChapterSection = (chIdx, secIdx, key, val) => setData((p) => ({
    ...p,
    chapters: p.chapters.map((c, i) => i === chIdx
      ? { ...c, sections: (c.sections || []).map((s, j) => j === secIdx ? { ...s, [key]: val } : s) }
      : c),
  }));
  const removeChapterSection = (chIdx, secIdx) => setData((p) => ({
    ...p,
    chapters: p.chapters.map((c, i) => i === chIdx
      ? { ...c, sections: (c.sections || []).filter((_, j) => j !== secIdx) }
      : c),
  }));

  const importTocFromPaste = () => {
    const raw = (tocPasteText || '').trim();
    if (!raw) return;
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed = [];
    let pending = '';
    const pageOnly = /^([ivxlcdm]+|\d+)$/i;
    const titlePage = /^(.*?)\s+([ivxlcdm]+|\d+)$/i;
    lines.forEach((line) => {
      if (/^title\s+page\s*no\.?$/i.test(line)) return;
      if (pageOnly.test(line) && pending) {
        parsed.push({ title: pending.trim(), page: line });
        pending = '';
        return;
      }
      const m = line.match(titlePage);
      if (m) {
        const fullTitle = `${pending} ${m[1]}`.trim();
        parsed.push({ title: fullTitle, page: m[2] });
        pending = '';
      } else {
        pending = `${pending} ${line}`.trim();
      }
    });
    if (pending) parsed.push({ title: pending, page: '' });

    const chapters = [];
    let current = null;
    parsed.forEach((row) => {
      const t = row.title.replace(/\s+/g, ' ').trim();
      const chMatch = t.match(/^Chapter\s+(\d+)\s+(.+)$/i);
      const secMatch = t.match(/^(\d+\.\d+)\s+(.+)$/);
      if (chMatch) {
        current = {
          id: uid(),
          number: Number(chMatch[1]),
          title: chMatch[2],
          toc_page: row.page || '',
          title_size: 17,
          title_bold: true,
          subheading_size: 13,
          content_size: 11,
          content: '',
          sections: [],
        };
        chapters.push(current);
      } else if (secMatch && current) {
        current.sections.push({
          id: uid(),
          code: secMatch[1],
          heading: secMatch[2],
          toc_page: row.page || current.toc_page || '',
          content: '',
        });
      }
    });

    if (!chapters.length) {
      toast.error('Could not parse pasted TOC');
      return;
    }
    setData((p) => ({ ...p, chapters }));
    toast.success('TOC imported into chapters');
  };

  const addFigureFromChapter = () => {
    const ch = data?.chapters?.[activeChapter];
    const title = (newFigureTitle || '').trim();
    if (!ch || !title) return;

    setData((p) => {
      const chapterNo = Number(ch.number) || activeChapter + 1;
      const sameChapterCount = (p.figures || []).filter((f) => String(f.fig_no || '').startsWith(`Figure ${chapterNo}.`)).length;
      return {
        ...p,
        figures: [
          ...(p.figures || []),
          {
            id: uid(),
            fig_no: `Figure ${chapterNo}.${sameChapterCount + 1}`,
            title,
            page_no: String(ch.toc_page || chapterNo),
          },
        ],
      };
    });

    setNewFigureTitle('');
    toast.success('Figure added to List of Figures');
  };

  const setRef = (type, idx, v) => setData((p) => ({ ...p, [`ref_${type}`]: p[`ref_${type}`].map((r, i) => i === idx ? { ...r, text: v } : r) }));
  const addRef = (type) => setData((p) => ({ ...p, [`ref_${type}`]: [...(p[`ref_${type}`] || []), { id: uid(), text: '' }] }));
  const removeRef = (type, idx) => setData((p) => ({ ...p, [`ref_${type}`]: p[`ref_${type}`].filter((_, i) => i !== idx) }));

  const setSummaryRow = (section, idx, v) => setData((p) => ({
    ...p,
    project_summary: {
      ...p.project_summary,
      [section]: (p.project_summary?.[section] || []).map((r, i) => i === idx ? { ...r, a: v } : r),
    },
  }));
  const setSummaryLayout = (section, mode) => setData((p) => ({
    ...p,
    summary_layout: { ...(p.summary_layout || {}), [section]: mode },
  }));

  const setAppendix = (idx, k, v) => setData((p) => ({ ...p, appendix: p.appendix.map((a, i) => i === idx ? { ...a, [k]: v } : a) }));
  const addAppendix = () => setData((p) => ({ ...p, appendix: [...(p.appendix || []), { id: uid(), term: '', definition: '' }] }));
  const removeAppendix = (idx) => setData((p) => ({ ...p, appendix: p.appendix.filter((_, i) => i !== idx) }));

  // ─── FIX: Logo upload handler — reads file via FileReader and saves base64 ──
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image too large — max 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => set('logo_base64', ev.target.result);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-uploaded if needed
    e.target.value = '';
  };

  const save = async () => {
    setSaving(true);
    try {
      await reportAPI.saveTemplateLock(data);
      setLastSavedAt(new Date().toLocaleTimeString());
      toast.success('Saved!');
    }
    catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const downloadWord = async () => {
    try {
      await reportAPI.saveTemplateLock(data);
      const res = await reportAPI.downloadTemplateLockDocx();
      const blob = new Blob(
        [res.data],
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      );
      await saveBlobWithPrompt(
        blob,
        'minor-project-report.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      toast.success('Word file downloaded');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      toast.error('Word download failed');
    }
  };

  const downloadPdf = async () => {
    if (!data) return;
    try {
      await generatePDF(data);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      toast.error('PDF download failed');
    }
  };

  const previewChannelRef = useRef(null);
  const previewTabRef = useRef(null);

  useEffect(() => {
    if (!previewChannelRef.current) {
      previewChannelRef.current = new BroadcastChannel('pdf_preview_channel');
    }
    return () => {
      previewChannelRef.current?.close();
      previewChannelRef.current = null;
    };
  }, []);

  const openFullPreview = () => {
    if (!data) return;
    
    localStorage.setItem('pdf_preview_data', JSON.stringify(data));
    
    previewChannelRef.current?.postMessage({ type: 'UPDATE_DATA', data });
    
    if (!previewTabRef.current || previewTabRef.current.closed) {
      previewTabRef.current = window.open('/report-preview', '_blank');
    }
  };
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => {
      localStorage.setItem('pdf_preview_data', JSON.stringify(data));
      previewChannelRef.current?.postMessage({ type: 'UPDATE_DATA', data });
    }, 900);
    return () => clearTimeout(t);
  }, [data]);

  if (loading) return <DashboardLayout><div className="card p-8 text-center">Loading...</div></DashboardLayout>;

  const S = SLIDES[slide];
  const progress = ((slide + 1) / SLIDES.length) * 100;

  return (
    <DashboardLayout>
      {/*
        ─── FIX: Hidden file input lives here — always mounted in DOM.
            logoInputRef.current?.click() will always work regardless of which slide is active.
      */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={handleLogoUpload}
      />

      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Report Editor
            </h1>
            <p className="text-xs text-gray-500">{S.label} — Slide {slide + 1}/{SLIDES.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {autoSaving ? 'Auto-saving...' : autoSaveError ? autoSaveError : lastSavedAt ? `Auto-saved at ${lastSavedAt}` : 'Auto-save enabled'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="w-3.5 h-3.5" /> Preview
            </Button>
            <Button variant="secondary" size="sm" onClick={openFullPreview}>
              <Eye className="w-3.5 h-3.5" /> Full PDF Preview
            </Button>
            <Button variant="secondary" size="sm" onClick={save} loading={saving}>
              <Save className="w-3.5 h-3.5" /> Save
            </Button>
            <Button size="sm" onClick={downloadPdf}>
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={downloadWord}>
              <Download className="w-3.5 h-3.5" /> Download Word
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-wrap">
          {SLIDES.map((s, i) => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setSlide(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  i === slide ? 'bg-blue-700 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}>
                <Icon className="w-3.5 h-3.5" />{s.label}
              </button>
            );
          })}
        </div>

        {/* Progress */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-gray-500">Tip: text select karke `Ctrl + B` dabao, bold marker `**text**` lag jayega.</p>

        {/* ── COVER ─────────────────────────────────────────────────── */}
        {slide === 0 && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Cover Page</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Input label="Project Title" value={data.project_title} onChange={(e) => set('project_title', e.target.value)} placeholder="AI-Powered Crop Disease Detection..." />
              </div>
              <Input label="Group No." value={data.group_no} onChange={(e) => set('group_no', e.target.value)} placeholder="GROUP NO. 27" />
              <Input label="Submission Month/Year" value={data.submission_month_year} onChange={(e) => set('submission_month_year', e.target.value)} placeholder="December – 2025" />
              <Input label="Certificate Period" value={data.certificate_period} onChange={(e) => set('certificate_period', e.target.value)} placeholder="Jul-2025 to Dec-2025" />
              <Input label="Degree" value={data.degree} onChange={(e) => set('degree', e.target.value)} />
              <div className="md:col-span-2">
                <Input label="Branch" value={data.branch} onChange={(e) => set('branch', e.target.value)} />
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Page Border Settings</p>
              <div className="grid md:grid-cols-2 gap-2 text-sm">
                {[
                  ['cover', 'Cover Page'],
                  ['certificate', 'Certificate'],
                  ['acknowledgement', 'Acknowledgement'],
                  ['toc', 'Table of Contents'],
                  ['abstract', 'Abstract'],
                  ['abbreviations', 'Abbreviations'],
                  ['figures', 'List of Figures'],
                  ['chapter_divider', 'Chapter Divider'],
                  ['chapter_content', 'Chapter Content'],
                  ['references', 'References'],
                  ['project_summary', 'Project Summary'],
                  ['appendix', 'Appendix'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={data.page_border_rules?.[key] !== false}
                      onChange={(e) => setData((p) => ({
                        ...p,
                        page_border_rules: { ...(p.page_border_rules || {}), [key]: e.target.checked },
                      }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Logo upload — FIX: button calls logoInputRef.current.click() directly */}
            <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Upload className="w-4 h-4" /> College Logo (appears on cover &amp; certificate pages)
              </p>
              {data.logo_base64 ? (
                <div className="flex items-center gap-3">
                  <img src={data.logo_base64} alt="logo preview" className="w-16 h-16 object-contain border rounded-lg bg-white" />
                  <div className="space-y-1">
                    <p className="text-xs text-green-600 font-medium">✓ Logo uploaded</p>
                    <button
                      onClick={() => set('logo_base64', '')}
                      className="text-xs text-red-500 hover:underline flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remove logo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {/* FIX: directly call logoInputRef.current.click() — no optional chaining issue */}
                  <button
                    onClick={() => { if (logoInputRef.current) logoInputRef.current.click(); }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    Choose Image
                  </button>
                  <span className="text-xs text-gray-400">PNG or JPG, max 2MB</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MEMBERS ───────────────────────────────────────────────── */}
        {slide === 1 && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
              <h2 className="font-semibold text-gray-900 dark:text-white">Team Members</h2>
              <Button size="sm" variant="secondary" onClick={addMember}><Plus className="w-3.5 h-3.5" /> Add</Button>
            </div>
            {(data.members || []).map((m, idx) => (
              <div key={m.id || idx} className="flex items-end gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mb-1">{idx + 1}</div>
                <div className="flex-1 grid md:grid-cols-2 gap-2">
                  <Input label="Name" value={m.name} onChange={(e) => setMember(idx, 'name', e.target.value)} placeholder="Shivam Kumar" />
                  <Input label="Enrollment No." value={m.enrollment} onChange={(e) => setMember(idx, 'enrollment', e.target.value)} placeholder="0187CS231217" />
                </div>
                {data.members.length > 1 && (
                  <button onClick={() => removeMember(idx)} className="mb-1 p-1.5 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── GUIDE & INSTITUTE ─────────────────────────────────────── */}
        {slide === 2 && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Guide & Institute</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Input label="Guide Name" value={data.guide_name} onChange={(e) => set('guide_name', e.target.value)} placeholder="Dr. Komal Tahiliani" />
              <Input label="Guide Designation" value={data.guide_designation} onChange={(e) => set('guide_designation', e.target.value)} />
              <Input label="HOD Name" value={data.hod_name} onChange={(e) => set('hod_name', e.target.value)} placeholder="Prof. Nargish Gupta" />
              <Input label="Principal Name" value={data.principal_name} onChange={(e) => set('principal_name', e.target.value)} placeholder="Dr. Manish Billore" />
              <Input label="Project Coordinator" value={data.project_coordinator} onChange={(e) => set('project_coordinator', e.target.value)} placeholder="Prof. Mayank Kurchaniya" />
              <div className="md:col-span-2"><Input label="Institute" value={data.institute} onChange={(e) => set('institute', e.target.value)} /></div>
              <div className="md:col-span-2"><Input label="Department" value={data.department} onChange={(e) => set('department', e.target.value)} /></div>
            </div>
          </div>
        )}

        {/* ── ABSTRACT ─────────────────────────────────────────────── */}
        {slide === 3 && (
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Abstract</h2>
            <textarea className="input min-h-[320px] resize-y font-serif text-sm" value={data.abstract}
              onChange={(e) => set('abstract', e.target.value)}
              onKeyDown={(e) => applyBoldShortcut(e, (v) => set('abstract', v))}
              placeholder="Write abstract here..." />
            <p className="text-xs text-gray-400">{(data.abstract || '').length} characters</p>
          </div>
        )}

        {/* ── ABBREVIATIONS ─────────────────────────────────────────── */}
        {slide === 4 && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
              <h2 className="font-semibold text-gray-900 dark:text-white">List of Abbreviations</h2>
              <Button size="sm" variant="secondary" onClick={addAbbr}><Plus className="w-3.5 h-3.5" /> Add</Button>
            </div>
            <div className="grid grid-cols-[120px_1fr_36px] gap-2 text-xs font-bold text-gray-500 px-1">
              <span>Abbreviation</span><span>Description</span><span></span>
            </div>
            {(data.abbreviations || []).map((a, idx) => (
              <div key={a.id || idx} className="grid grid-cols-[120px_1fr_36px] gap-2 items-start">
                <input className="input text-sm" value={a.abbr} onChange={(e) => setAbbr(idx, 'abbr', e.target.value)} placeholder="API" />
                <input className="input text-sm" value={a.desc} onChange={(e) => setAbbr(idx, 'desc', e.target.value)} placeholder="Application Programming Interface" />
                <button onClick={() => removeAbbr(idx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded mt-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        {/* ── LIST OF FIGURES ─────────────────────────────────────────── */}
        {slide === 5 && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
              <h2 className="font-semibold text-gray-900 dark:text-white">List of Figures</h2>
              <Button size="sm" variant="secondary" onClick={addFig}><Plus className="w-3.5 h-3.5" /> Add</Button>
            </div>
            <div className="grid grid-cols-[110px_1fr_80px_36px] gap-2 text-xs font-bold text-gray-500 px-1">
              <span>Figure No.</span><span>Title</span><span>Page No.</span><span></span>
            </div>
            {(data.figures || []).map((f, idx) => (
              <div key={f.id || idx} className="grid grid-cols-[110px_1fr_80px_36px] gap-2 items-start">
                <input className="input text-sm" value={f.fig_no} onChange={(e) => setFig(idx, 'fig_no', e.target.value)} placeholder="Figure 6.1" />
                <input className="input text-sm" value={f.title} onChange={(e) => setFig(idx, 'title', e.target.value)} placeholder="Use Case Diagram" />
                <input className="input text-sm" value={f.page_no} onChange={(e) => setFig(idx, 'page_no', e.target.value)} placeholder="13" />
                <button onClick={() => removeFig(idx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded mt-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        {/* ── CHAPTERS ─────────────────────────────────────────────── */}
        {slide === 6 && (
          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Paste TOC (Auto Fill Chapters)</h2>
              <textarea
                className="input min-h-[150px] resize-y text-sm"
                value={tocPasteText}
                onChange={(e) => setTocPasteText(e.target.value)}
                placeholder="Paste TITLE PAGE NO. table text here..."
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={importTocFromPaste}>
                  <Plus className="w-3.5 h-3.5" /> Import TOC
                </Button>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                <h2 className="font-semibold text-gray-900 dark:text-white">Chapters</h2>
                <Button size="sm" variant="secondary" onClick={() => { addChapter(); setActiveChapter((data.chapters || []).length); }}>
                  <Plus className="w-3.5 h-3.5" /> Add Chapter
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(data.chapters || []).map((ch, i) => (
                  <button key={ch.id || i} onClick={() => setActiveChapter(i)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${i === activeChapter ? 'bg-blue-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                    Ch {ch.number || i + 1}: {ch.title || 'Untitled'}
                  </button>
                ))}
              </div>
            </div>
            {data.chapters[activeChapter] && (
              <div className="card p-5 space-y-3">
                <div className="grid grid-cols-[80px_1fr] gap-3">
                  <Input label="Chapter No." type="number" value={data.chapters[activeChapter].number} onChange={(e) => setChapter(activeChapter, 'number', e.target.value)} />
                  <Input label="Chapter Title" value={data.chapters[activeChapter].title} onChange={(e) => setChapter(activeChapter, 'title', e.target.value)} placeholder="Introduction" />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Input label="TOC Page No." value={data.chapters[activeChapter].toc_page || ''} onChange={(e) => setChapter(activeChapter, 'toc_page', e.target.value)} />
                </div>
                <div className="grid md:grid-cols-4 gap-3">
                  <Input
                    label="Heading Font Size"
                    type="number"
                    value={data.chapters[activeChapter].title_size ?? 17}
                    onChange={(e) => setChapter(activeChapter, 'title_size', e.target.value)}
                  />
                  <Input
                    label="Subheading Font Size"
                    type="number"
                    value={data.chapters[activeChapter].subheading_size ?? 13}
                    onChange={(e) => setChapter(activeChapter, 'subheading_size', e.target.value)}
                  />
                  <Input
                    label="Content Font Size"
                    type="number"
                    value={data.chapters[activeChapter].content_size ?? 11}
                    onChange={(e) => setChapter(activeChapter, 'content_size', e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mt-6">
                    <input
                      type="checkbox"
                      checked={data.chapters[activeChapter].title_bold !== false}
                      onChange={(e) => setChapter(activeChapter, 'title_bold', e.target.checked)}
                    />
                    Keep Chapter Heading Bold
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                  <textarea className="input min-h-[300px] resize-y font-serif text-sm" value={data.chapters[activeChapter].content}
                    onChange={(e) => setChapter(activeChapter, 'content', e.target.value)}
                    onKeyDown={(e) => applyBoldShortcut(e, (v) => setChapter(activeChapter, 'content', v))}
                    placeholder="Write chapter content here..." />
                  <p className="text-xs text-gray-400 mt-1">{(data.chapters[activeChapter].content || '').length} characters · PDF alignment: Justified (both sides)</p>
                </div>
                <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sub-headings & Content</p>
                    <Button size="sm" variant="secondary" onClick={() => addChapterSection(activeChapter)}>
                      <Plus className="w-3.5 h-3.5" /> Add Sub-heading
                    </Button>
                  </div>
                  {(data.chapters[activeChapter].sections || []).map((sec, secIdx) => (
                    <div key={sec.id || secIdx} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                      <div className="grid md:grid-cols-2 gap-2">
                        <Input
                          label="Section No."
                          value={sec.code || ''}
                          onChange={(e) => setChapterSection(activeChapter, secIdx, 'code', e.target.value)}
                          placeholder="1.1"
                        />
                        <Input
                          label="TOC Page No."
                          value={sec.toc_page || ''}
                          onChange={(e) => setChapterSection(activeChapter, secIdx, 'toc_page', e.target.value)}
                          placeholder="1"
                        />
                      </div>
                      <Input
                        label={`Sub-heading ${secIdx + 1}`}
                        value={sec.heading}
                        onChange={(e) => setChapterSection(activeChapter, secIdx, 'heading', e.target.value)}
                        placeholder="Enter sub-heading"
                      />
                      <textarea
                        className="input min-h-[110px] resize-y text-sm"
                        value={sec.content}
                        onChange={(e) => setChapterSection(activeChapter, secIdx, 'content', e.target.value)}
                        onKeyDown={(e) => applyBoldShortcut(e, (v) => setChapterSection(activeChapter, secIdx, 'content', v))}
                        placeholder="Enter sub-heading content..."
                      />
                      {(data.chapters[activeChapter].sections || []).length > 1 && (
                        <Button size="sm" variant="danger" onClick={() => removeChapterSection(activeChapter, secIdx)}>
                          <Trash2 className="w-3.5 h-3.5" /> Remove Sub-heading
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Figure (auto updates List of Figures)</p>
                  <div className="flex gap-2">
                    <input
                      className="input text-sm flex-1"
                      value={newFigureTitle}
                      onChange={(e) => setNewFigureTitle(e.target.value)}
                      placeholder="Figure title (e.g., Use Case Diagram)"
                    />
                    <Button size="sm" variant="secondary" onClick={addFigureFromChapter} disabled={!newFigureTitle.trim()}>
                      <Plus className="w-3.5 h-3.5" /> Add Figure
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">Page No. auto set from current chapter number and added to the same List of Figures table format.</p>
                </div>
                {data.chapters.length > 1 && (
                  <Button size="sm" variant="danger" onClick={() => { removeChapter(activeChapter); setActiveChapter(Math.max(0, activeChapter - 1)); }}>
                    <Trash2 className="w-3.5 h-3.5" /> Remove This Chapter
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── REFERENCES ─────────────────────────────────────────────── */}
        {slide === 7 && (
          <div className="space-y-4">
            {['journals', 'websites'].map((type) => (
              <div key={type} className="card p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                  <h2 className="font-semibold text-gray-900 dark:text-white capitalize">
                    {type === 'journals' ? 'Journals / Research Papers' : 'Websites'}
                  </h2>
                  <Button size="sm" variant="secondary" onClick={() => addRef(type)}><Plus className="w-3.5 h-3.5" /> Add</Button>
                </div>
                {(data[`ref_${type}`] || []).map((r, idx) => (
                  <div key={r.id || idx} className="flex gap-2 items-start">
                    <span className="text-sm text-gray-400 mt-2 flex-shrink-0">[{(type === 'websites' ? (data.ref_journals || []).length : 0) + idx + 1}]</span>
                    <input className="input text-sm flex-1" value={r.text} onChange={(e) => setRef(type, idx, e.target.value)} placeholder="https://..." />
                    <button onClick={() => removeRef(type, idx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded mt-0.5 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── PROJECT SUMMARY ─────────────────────────────────────────── */}
        {slide === 8 && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex flex-wrap gap-1.5 border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                {['about', 'tools', 'design', 'requirements', 'testing'].map((s) => (
                  <button key={s} onClick={() => setActiveSumSection(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${activeSumSection === s ? 'bg-blue-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200'}`}>
                    {s === 'about'
                      ? 'About Project'
                      : s === 'tools'
                        ? 'Tools & Technologies'
                        : s === 'design'
                          ? 'Software Design & Coding'
                          : s === 'requirements'
                            ? 'Project Requirements'
                            : 'Testing'}
                  </button>
                ))}
              </div>
              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Subheading Format</label>
                <select
                  className="input text-xs py-1.5 max-w-[170px]"
                  value={(data.summary_layout || {})[activeSumSection] || 'table'}
                  onChange={(e) => setSummaryLayout(activeSumSection, e.target.value)}
                >
                  <option value="table">Table</option>
                  <option value="text">Normal Text</option>
                </select>
              </div>
              <div className="space-y-3">
                {((data.project_summary || {})[activeSumSection] || []).map((row, idx) => (
                  <div key={row.id || idx} className="grid grid-cols-[1fr_1fr] gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 self-start pt-1">{row.q}</div>
                    <textarea className="input text-sm min-h-[56px] resize-y" value={row.a}
                      onChange={(e) => setSummaryRow(activeSumSection, idx, e.target.value)}
                      onKeyDown={(e) => applyBoldShortcut(e, (v) => setSummaryRow(activeSumSection, idx, v))}
                      placeholder="Answer..." />
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">Project Narrative</h2>
              <textarea className="input min-h-[200px] resize-y font-serif text-sm" value={data.project_narrative}
                onChange={(e) => set('project_narrative', e.target.value)}
                onKeyDown={(e) => applyBoldShortcut(e, (v) => set('project_narrative', v))}
                placeholder="Write project narrative..." />
            </div>
          </div>
        )}

        {/* ── APPENDIX ─────────────────────────────────────────────── */}
        {slide === 9 && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Appendix-1: Glossary of Terms</h2>
                <p className="text-xs text-gray-400 mt-0.5">Sorted alphabetically in PDF</p>
              </div>
              <Button size="sm" variant="secondary" onClick={addAppendix}><Plus className="w-3.5 h-3.5" /> Add Term</Button>
            </div>
            {(data.appendix || []).map((a, idx) => (
              <div key={a.id || idx} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1"><Input label="Term" value={a.term} onChange={(e) => setAppendix(idx, 'term', e.target.value)} placeholder="React.js" /></div>
                  <button onClick={() => removeAppendix(idx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded mt-5 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Definition</label>
                  <textarea className="input text-sm min-h-[80px] resize-y" value={a.definition}
                    onChange={(e) => setAppendix(idx, 'definition', e.target.value)}
                    onKeyDown={(e) => applyBoldShortcut(e, (v) => setAppendix(idx, 'definition', v))}
                    placeholder="Write definition here..." />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          <Button variant="secondary" size="sm" onClick={() => setSlide((p) => Math.max(0, p - 1))} disabled={slide === 0}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-xs text-gray-500">{slide + 1} / {SLIDES.length}</span>
          {slide < SLIDES.length - 1
            ? <Button size="sm" onClick={() => setSlide((p) => p + 1)}>Next <ChevronRight className="w-4 h-4" /></Button>
            : (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={downloadWord}>
                  <Download className="w-4 h-4" /> Download Word
                </Button>
                <Button size="sm" onClick={downloadPdf}>
                  <Download className="w-4 h-4" /> Download PDF
                </Button>
              </div>
            )
          }
        </div>
      </div>

      {/* ── PREVIEW MODAL ────────────────────────────────────────────── */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" /> Cover Page Preview
              </h2>
              <button onClick={() => setShowPreview(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex justify-center overflow-auto max-h-[70vh]">
              <CoverPreview data={data} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowPreview(false)}>Close</Button>
              <Button onClick={async () => { setShowPreview(false); await downloadPdf(); }}>
                <Download className="w-4 h-4" /> Download PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {showFullPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-6xl w-full h-[90vh] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" /> Full PDF Preview
              </h2>
              <button onClick={() => setShowFullPreview(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="h-[calc(90vh-110px)] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white">
              {previewUrl && <iframe src={previewUrl} title="Full PDF Preview" className="w-full h-full" />}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default TemplateLockReport;
