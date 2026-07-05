/**
 * LaTeX/Overleaf resume export. Reuses the same `ResumeData` shared model as
 * `jake-template.tsx` (the existing React-PDF renderer) rather than a separate
 * data shape — one CV model feeding two export formats. The document
 * boilerplate/macros are career-ops's `templates/cv-template.tex` (itself
 * based on the sb2nov/Gabriel Sison "Jake's resume" template, MIT), ported
 * to build directly from `ResumeData` instead of `{{PLACEHOLDER}}` substitution.
 */
import type {
  ResumeData,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
  ResumeSkillGroup,
} from "@/api/contracts/resume";
import { escapeLatex, sanitizeLatexUrl } from "./latex-escape";

function dateRange(start: string | undefined, end: string | undefined): string {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (!s && !e) return "";
  if (s && !e) return `${s} - Present`;
  if (!s && e) return e;
  return `${s} - ${e}`;
}

function buildEducation(entries: ResumeEducation[]): string {
  return entries
    .map((e) => {
      let block = `    \\resumeSubheading\n      {${escapeLatex(e.school)}}{${escapeLatex(dateRange(e.start, e.end))}}\n      {${escapeLatex(e.degree)}}{}`;
      if (e.details.length > 0) {
        const items = e.details.map((d) => `            \\resumeItem{${escapeLatex(d)}}`).join("\n");
        block += `\n        \\resumeItemListStart\n${items}\n        \\resumeItemListEnd`;
      }
      return block;
    })
    .join("\n\n");
}

function buildExperience(entries: ResumeExperience[]): string {
  return entries
    .map((e) => {
      const bullets = e.bullets.map((b) => `            \\resumeItem{${escapeLatex(b)}}`).join("\n");
      return `    \\resumeSubheading\n      {${escapeLatex(e.company)}}{${escapeLatex(dateRange(e.start, e.end))}}\n      {${escapeLatex(e.title)}}{${escapeLatex(e.location)}}\n      \\resumeItemListStart\n${bullets}\n      \\resumeItemListEnd`;
    })
    .join("\n\n");
}

function buildProjects(entries: ResumeProject[]): string {
  return entries
    .map((e) => {
      const context = e.keywords.length > 0 ? ` \\emph{$|$ ${escapeLatex(e.keywords.join(", "))}}` : "";
      const bulletLines = e.bullets.length > 0 ? e.bullets : e.description ? [e.description] : [];
      const bullets = bulletLines.map((b) => `            \\resumeItem{${escapeLatex(b)}}`).join("\n");
      return `    \\resumeProjectHeading\n      {\\textbf{${escapeLatex(e.name)}}${context}}{}\n      \\resumeItemListStart\n${bullets}\n      \\resumeItemListEnd`;
    })
    .join("\n\n");
}

function buildSkills(groups: ResumeSkillGroup[]): string {
  return groups
    .map((g) => `        \\textbf{${escapeLatex(g.group)}}{: ${escapeLatex(g.items.join(", "))}} \\\\`)
    .join("\n");
}

const DOCUMENT_HEADER = String.raw`%-------------------------
% CareerPilot LaTeX CV Template
% Based on: Gabriel Sison / sb2nov resume template (MIT)
%------------------------
\documentclass[letterpaper,11pt]{article}
\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage{fontawesome}
\usepackage{multicol}
\setlength{\multicolsep}{-3.0pt}
\setlength{\columnsep}{-1pt}
\input{glyphtounicode}
\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}
\addtolength{\oddsidemargin}{-0.6in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1.19in}
\addtolength{\topmargin}{-.7in}
\addtolength{\textheight}{1.4in}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}
\titleformat{\section}{
  \vspace{-7pt}\scshape\raggedright\large\bfseries
}{}{0em}{}[\color{black}\titlerule \vspace{0pt}]
\pdfgentounicode=1

\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-3pt}}
  }
}
\newcommand{\resumeSubheading}[4]{
  \vspace{-3pt}\item
    \begin{tabular*}{1.0\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & \textbf{\small #2} \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}
\newcommand{\resumeProjectHeading}[2]{
  \vspace{-3pt}\item
    \begin{tabular*}{1.0\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & \textbf{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}
\renewcommand\labelitemi{$\vcenter{\hbox{\tiny$\bullet$}}$}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.0in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{0pt}}
`;

/** Builds a complete .tex document from the shared resume data model. */
export function buildResumeLatex(data: ResumeData): string {
  const { basics } = data;
  const contactLineParts = [basics.location, basics.phone].filter((v): v is string => !!v && v.trim() !== "");
  const contactLine = contactLineParts.join(" | ");

  const emailUrl = basics.email ? sanitizeLatexUrl(`mailto:${basics.email}`) : "";
  const linkedinUrl = sanitizeLatexUrl(basics.linkedin);
  const githubUrl = sanitizeLatexUrl(basics.github);

  const links: string[] = [];
  if (basics.email) {
    links.push(
      `        \\href{${emailUrl}}{\\raisebox{-0.2\\height}\\faEnvelope\\ \\underline{${escapeLatex(basics.email)}}}`,
    );
  }
  if (basics.linkedin) {
    links.push(
      `        \\href{${linkedinUrl}}{\\raisebox{-0.2\\height}\\faLinkedin\\ \\underline{${escapeLatex(basics.linkedin)}}}`,
    );
  }
  if (basics.github) {
    links.push(
      `        \\href{${githubUrl}}{\\raisebox{-0.2\\height}\\faGithub\\ \\underline{${escapeLatex(basics.github)}}}`,
    );
  }

  const sections: string[] = [];
  if (data.education.length > 0) {
    sections.push(
      `\\section{Education}\n  \\resumeSubHeadingListStart\n${buildEducation(data.education)}\n  \\resumeSubHeadingListEnd`,
    );
  }
  if (data.experience.length > 0) {
    sections.push(
      `\\section{Work Experience}\n  \\resumeSubHeadingListStart\n${buildExperience(data.experience)}\n  \\resumeSubHeadingListEnd`,
    );
  }
  if (data.projects.length > 0) {
    sections.push(
      `\\section{Personal Projects}\n\\resumeSubHeadingListStart\n${buildProjects(data.projects)}\n\\resumeSubHeadingListEnd`,
    );
  }
  if (data.skills.length > 0) {
    sections.push(
      `\\section{Technical Skills}\n\\vspace{-7pt}\n\\begin{itemize}\n[leftmargin=0.15in, label={}]\\small{\\item{\n${buildSkills(data.skills)}\n}}\n\\end{itemize}`,
    );
  }

  return String.raw`${DOCUMENT_HEADER}
\begin{document}
    \begin{center}
        {\Huge\scshape ${escapeLatex(basics.name) || " "}}
        \\ ${escapeLatex(contactLine)}\\
        \small
${links.join(" ~\n")}
    \end{center}

${sections.join("\n\n")}

\end{document}
`;
}
