const StudentReport = require('../models/StudentReport');
const Student = require('../models/Student');
const apiResponse = require('../utils/apiResponse');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');

const defaultPayload = (student = null) => ({
  cover: {
    institute: 'Institute Name',
    department: student?.branch ? `${student.branch} Department` : 'Department Name',
    reportTitle: 'Final Minor Project Report',
    projectTitle: '',
    submittedBy: student?.name || '',
    enrollmentNo: student?.enrollment_no || '',
    guideName: '',
    academicYear: '',
    submissionDate: new Date().toISOString().slice(0, 10),
  },
  sections: [
    { key: 'certificate', title: 'Certificate', content: '' },
    { key: 'declaration', title: 'Declaration', content: '' },
    { key: 'acknowledgement', title: 'Acknowledgement', content: '' },
    { key: 'abstract', title: 'Abstract', content: '' },
    { key: 'introduction', title: 'Introduction', content: '' },
    { key: 'problem_statement', title: 'Problem Statement', content: '' },
    { key: 'objective_scope', title: 'Objectives & Scope', content: '' },
    { key: 'methodology', title: 'Methodology', content: '' },
    { key: 'implementation', title: 'Implementation', content: '' },
    { key: 'result_analysis', title: 'Results & Analysis', content: '' },
    { key: 'conclusion_future', title: 'Conclusion & Future Work', content: '' },
    { key: 'references', title: 'References', content: '' },
  ],
  teamMembers: [
    { name: student?.name || '', enrollmentNo: student?.enrollment_no || '', role: 'Student' },
  ],
  snapshots: [],
});

exports.getMyReport = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id }).lean();
    let report = await StudentReport.findOne({ user_id: req.user._id, report_type: 'minor_project' }).lean();
    if (!report) {
      report = await StudentReport.create({
        user_id: req.user._id,
        report_type: 'minor_project',
        title: 'Final Minor Project Report',
        payload: defaultPayload(student),
      });
      report = report.toObject();
    }
    return apiResponse.success(res, report);
  } catch (error) { return next(error); }
};

exports.saveMyReport = async (req, res, next) => {
  try {
    const { title, payload } = req.body;
    if (!payload || typeof payload !== 'object') {
      return apiResponse.error(res, 'payload object is required', 400);
    }

    const report = await StudentReport.findOneAndUpdate(
      { user_id: req.user._id, report_type: 'minor_project' },
      {
        $set: {
          title: title || 'Final Minor Project Report',
          payload,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return apiResponse.success(res, report, 'Report saved');
  } catch (error) { return next(error); }
};

const defaultTemplateMap = (student = null) => ({
  project_title: 'ECOLEARN : GAMIFIED ENVIRONMENTAL EDUCATION FOR CLIMATE ACTION',
  group_no: 'GROUP NO. 25',
  student_1_name: student?.name || 'Arjun Yadav',
  student_1_enrollment: student?.enrollment_no || '0187CS231050',
  student_2_name: 'Prachi Ahirwar',
  student_2_enrollment: '0187CS231159',
  student_3_name: 'Aradhy Raghuwanshi',
  student_3_enrollment: '0187CS231049',
  student_4_name: 'Anmol Sharma',
  student_4_enrollment: '0187CS231043',
  student_5_name: 'Neelu Thakur',
  student_5_enrollment: '0187CS231137',
  student_6_name: 'Bittu Kumar',
  student_6_enrollment: '0187CS231071',
  guide_name: 'Dr. Komal Tahiliani',
  submission_month_year: 'December – 2025',
  certificate_period: 'Jul-2025 to Dec-2025',
  custom_replacements: [],
});

const normalizeTemplatePayload = (payload = {}, student = null) => {
  const fallback = defaultTemplateMap(student);
  const members = Array.isArray(payload.members) ? payload.members : [];
  const m = (idx) => members[idx] || {};

  return {
    project_title: payload.project_title || fallback.project_title,
    group_no: payload.group_no || fallback.group_no,
    student_1_name: payload.student_1_name || m(0).name || fallback.student_1_name,
    student_1_enrollment: payload.student_1_enrollment || m(0).enrollment || fallback.student_1_enrollment,
    student_2_name: payload.student_2_name || m(1).name || fallback.student_2_name,
    student_2_enrollment: payload.student_2_enrollment || m(1).enrollment || fallback.student_2_enrollment,
    student_3_name: payload.student_3_name || m(2).name || fallback.student_3_name,
    student_3_enrollment: payload.student_3_enrollment || m(2).enrollment || fallback.student_3_enrollment,
    student_4_name: payload.student_4_name || m(3).name || fallback.student_4_name,
    student_4_enrollment: payload.student_4_enrollment || m(3).enrollment || fallback.student_4_enrollment,
    student_5_name: payload.student_5_name || m(4).name || fallback.student_5_name,
    student_5_enrollment: payload.student_5_enrollment || m(4).enrollment || fallback.student_5_enrollment,
    student_6_name: payload.student_6_name || m(5).name || fallback.student_6_name,
    student_6_enrollment: payload.student_6_enrollment || m(5).enrollment || fallback.student_6_enrollment,
    guide_name: payload.guide_name || fallback.guide_name,
    submission_month_year: payload.submission_month_year || fallback.submission_month_year,
    certificate_period: payload.certificate_period || fallback.certificate_period,
    custom_replacements: Array.isArray(payload.custom_replacements) ? payload.custom_replacements : [],
  };
};

exports.getTemplateLockData = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id }).lean();
    const report = await StudentReport.findOne({ user_id: req.user._id, report_type: 'minor_project_template_lock' }).lean();
    const data = report?.payload || defaultTemplateMap(student);
    return apiResponse.success(res, data);
  } catch (error) { return next(error); }
};

exports.saveTemplateLockData = async (req, res, next) => {
  try {
    const payload = req.body || {};
    await StudentReport.findOneAndUpdate(
      { user_id: req.user._id, report_type: 'minor_project_template_lock' },
      { $set: { title: 'Minor Project Template Lock', payload } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return apiResponse.success(res, payload, 'Template data saved');
  } catch (error) { return next(error); }
};

const psScript = `
param([string]$TemplatePath,[string]$OutputPath,[string]$DataPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$temp = Join-Path $env:TEMP ("docx_" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $temp | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($TemplatePath, $temp)
$docPath = Join-Path $temp "word\\document.xml"
$xml = Get-Content -Raw $docPath
$data = Get-Content -Raw $DataPath | ConvertFrom-Json

$replace = @{
  "ECOLEARN : GAMIFIED ENVIRONMENTAL EDUCATION FOR CLIMATE ACTION" = [string]$data.project_title
  "GROUP NO. 25" = [string]$data.group_no
  "Arjun Yadav" = [string]$data.student_1_name
  "0187CS231050" = [string]$data.student_1_enrollment
  "Prachi Ahirwar" = [string]$data.student_2_name
  "0187CS231159" = [string]$data.student_2_enrollment
  "Aradhy Raghuwanshi" = [string]$data.student_3_name
  "0187CS231049" = [string]$data.student_3_enrollment
  "Anmol Sharma" = [string]$data.student_4_name
  "0187CS231043" = [string]$data.student_4_enrollment
  "Neelu Thakur" = [string]$data.student_5_name
  "0187CS231137" = [string]$data.student_5_enrollment
  "Bittu Kumar" = [string]$data.student_6_name
  "0187CS231071" = [string]$data.student_6_enrollment
  "Dr. Komal Tahiliani" = [string]$data.guide_name
  "December â€“ 2025" = [string]$data.submission_month_year
  "Jul-2025 to Dec-2025" = [string]$data.certificate_period
}

foreach ($k in $replace.Keys) {
  if ($replace[$k]) {
    $safeK = [regex]::Escape($k)
    $safeV = [string]$replace[$k] -replace '\\$','$$'
    $xml = [regex]::Replace($xml, $safeK, $safeV)
  }
}

if ($data.custom_replacements) {
  foreach ($item in $data.custom_replacements) {
    if ($item.find -and $item.replace) {
      $xml = [regex]::Replace($xml, [regex]::Escape([string]$item.find), [string]$item.replace -replace '\\$','$$')
    }
  }
}

Set-Content -Path $docPath -Value $xml -NoNewline
if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($temp, $OutputPath)
Remove-Item -Recurse -Force $temp
`;

exports.downloadTemplateLockedDocx = async (req, res, next) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'minor-project-template.docx');
    if (!fs.existsSync(templatePath)) {
      return apiResponse.error(res, 'Template file not found', 404);
    }
    const student = await Student.findOne({ user_id: req.user._id }).lean();
    const saved = await StudentReport.findOne({ user_id: req.user._id, report_type: 'minor_project_template_lock' }).lean();
    const payload = normalizeTemplatePayload(saved?.payload || {}, student);

    const tmpBase = path.join(os.tmpdir(), `minor_tpl_${crypto.randomUUID()}`);
    const outPath = `${tmpBase}.docx`;
    const dataPath = `${tmpBase}.json`;
    const psPath = `${tmpBase}.ps1`;
    fs.writeFileSync(dataPath, JSON.stringify(payload), 'utf8');
    fs.writeFileSync(psPath, psScript, 'utf8');

    await new Promise((resolve, reject) => {
      execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', psPath, '-TemplatePath', templatePath, '-OutputPath', outPath, '-DataPath', dataPath], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="minor-project-report-template-lock.docx"');
    const stream = fs.createReadStream(outPath);
    stream.on('close', () => {
      [outPath, dataPath, psPath].forEach((p) => { if (fs.existsSync(p)) fs.unlinkSync(p); });
    });
    return stream.pipe(res);
  } catch (error) { return next(error); }
};
