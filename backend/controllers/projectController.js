const Team = require('../models/Team');
const Student = require('../models/Student');
const User = require('../models/User');
const apiResponse = require('../utils/apiResponse');
const { createNotifications } = require('../utils/notifications');
const { buildWorkload, buildSprintVelocity, buildDashboardMetrics } = require('../utils/projectMetrics');

const canManageTeamProject = async (team, user) => {
  if (!team || !user) return false;
  if (user.role === 'admin') return true;

  const student = await Student.findOne({ user_id: user._id }).select('_id');
  if (student && team.members.some((m) => m.student_id.toString() === student._id.toString() && m.status === 'accepted')) {
    return true;
  }

  const isCreator = team.created_by?.toString() === user._id.toString();
  const isAssignedFaculty = team.assigned_faculty && user.role === 'faculty';
  return Boolean(isCreator || isAssignedFaculty);
};

const appendAuditLog = (team, userId, action, entityType, entityId, metadata = {}) => {
  team.project.audit_logs.push({ actor: userId, action, entity_type: entityType, entity_id: String(entityId), metadata });
};

const parseMentions = async (message = '') => {
  const handles = [...new Set((String(message).match(/@([a-zA-Z0-9._-]+)/g) || []).map((v) => v.slice(1).toLowerCase()))];
  if (!handles.length) return [];

  const candidates = await User.find({ $or: [{ username: { $in: handles } }, { email: { $in: handles } }] }).select('_id');
  return candidates.map((user) => user._id);
};

const ensureAccess = async (req, teamId) => {
  const team = await Team.findById(teamId)
    .populate('project.modules.assigned_to', 'name enrollment_no user_id')
    .populate('members.student_id', 'name user_id');
  if (!team) return { error: { code: 404, message: 'Team not found' } };

  const allowed = await canManageTeamProject(team, req.user);
  if (!allowed) return { error: { code: 403, message: 'Not allowed to manage project board' } };

  return { team };
};

const getProjectBoard = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);

    return apiResponse.success(res, {
      team_id: team._id,
      team_name: team.team_name,
      modules: team.project.modules,
      saved_views: team.project.saved_views || [],
      sprint: team.project.sprint || {},
      audit_logs: (team.project.audit_logs || []).slice(-200).reverse(),
    });
  } catch (error) { return next(error); }
};

const bulkUpdateModules = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);

    const { module_ids = [], status, assigned_to, priority } = req.body;
    if (!Array.isArray(module_ids) || module_ids.length === 0) return apiResponse.error(res, 'module_ids are required', 400);

    const updated = [];
    for (const moduleId of module_ids) {
      const module = team.project.modules.id(moduleId);
      if (!module) continue;
      if (status) module.status = status;
      if (assigned_to !== undefined) module.assigned_to = assigned_to || null;
      if (priority) module.priority = priority;
      module.updated_at = new Date();
      updated.push(module._id.toString());
    }

    appendAuditLog(team, req.user._id, 'bulk_module_update', 'module', updated.join(','), { status, assigned_to, priority, count: updated.length });
    await team.save();
    return apiResponse.success(res, { updated_count: updated.length, updated }, 'Modules updated');
  } catch (error) { return next(error); }
};

const addModuleEnhanced = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);

    const { module_name, description, assigned_to, due_date, priority, blocked_by, recurring, template_key, estimated_hours } = req.body;
    if (!module_name) return apiResponse.error(res, 'module_name is required', 400);

    team.project.modules.push({
      module_name,
      description,
      assigned_to: assigned_to || null,
      due_date: due_date || null,
      priority: priority || 'medium',
      blocked_by: Array.isArray(blocked_by) ? blocked_by : [],
      recurring: recurring?.enabled ? { enabled: true, frequency: recurring.frequency, next_run_at: recurring.next_run_at || null } : undefined,
      template_key: template_key || '',
      estimated_hours: Number(estimated_hours || 0),
    });

    const module = team.project.modules[team.project.modules.length - 1];
    appendAuditLog(team, req.user._id, 'module_created', 'module', module._id, { module_name });

    await team.save();
    return apiResponse.created(res, module, 'Task created');
  } catch (error) { return next(error); }
};

const addModuleComment = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);

    const module = team.project.modules.id(req.params.moduleId);
    if (!module) return apiResponse.error(res, 'Module not found', 404);

    const { message, parent_comment_id } = req.body;
    if (!message) return apiResponse.error(res, 'message is required', 400);

    const mentions = await parseMentions(message);
    module.comments.push({ author: req.user._id, message, parent_comment_id: parent_comment_id || null, mentions });

    appendAuditLog(team, req.user._id, 'comment_added', 'module', module._id, { hasMentions: mentions.length > 0 });
    await team.save();

    if (mentions.length) {
      await createNotifications(mentions.map((userId) => ({
        recipient: userId,
        type: 'mention',
        title: 'You were mentioned in a task',
        message: `${req.user.name} mentioned you in ${team.team_name}`,
        related_id: team._id,
        related_model: 'Team',
      })));
    }

    return apiResponse.created(res, module.comments[module.comments.length - 1], 'Comment added');
  } catch (error) { return next(error); }
};

const startTimer = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);

    const module = team.project.modules.id(req.params.moduleId);
    if (!module) return apiResponse.error(res, 'Module not found', 404);
    if (module.timer.running) return apiResponse.error(res, 'Timer already running', 400);

    module.timer.running = true;
    module.timer.started_at = new Date();
    module.timer.started_by = req.user._id;

    appendAuditLog(team, req.user._id, 'timer_started', 'module', module._id);
    await team.save();
    return apiResponse.success(res, module, 'Timer started');
  } catch (error) { return next(error); }
};

const stopTimer = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);

    const module = team.project.modules.id(req.params.moduleId);
    if (!module) return apiResponse.error(res, 'Module not found', 404);
    if (!module.timer.running || !module.timer.started_at) return apiResponse.error(res, 'Timer is not running', 400);

    const elapsedMs = new Date().getTime() - new Date(module.timer.started_at).getTime();
    const elapsedHours = Math.max(0, Number((elapsedMs / (1000 * 60 * 60)).toFixed(2)));
    module.actual_hours = Number((module.actual_hours + elapsedHours).toFixed(2));
    module.timer.running = false;
    module.timer.started_at = null;
    module.timer.started_by = null;

    appendAuditLog(team, req.user._id, 'timer_stopped', 'module', module._id, { elapsed_hours: elapsedHours });
    await team.save();

    return apiResponse.success(res, { module_id: module._id, elapsed_hours: elapsedHours, total_hours: module.actual_hours }, 'Timer stopped');
  } catch (error) { return next(error); }
};

const getWorkload = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);
    return apiResponse.success(res, buildWorkload(team));
  } catch (error) { return next(error); }
};

const getSprintAnalytics = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);
    return apiResponse.success(res, buildSprintVelocity(team));
  } catch (error) { return next(error); }
};

const getDashboard = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);
    return apiResponse.success(res, buildDashboardMetrics(team));
  } catch (error) { return next(error); }
};

const createSavedView = async (req, res, next) => {
  try {
    const { team, error } = await ensureAccess(req, req.params.id);
    if (error) return apiResponse.error(res, error.message, error.code);

    const { name, filters } = req.body;
    if (!name) return apiResponse.error(res, 'name is required', 400);

    team.project.saved_views.push({ name, filters: filters || {}, created_by: req.user._id });
    appendAuditLog(team, req.user._id, 'saved_view_created', 'saved_view', name);
    await team.save();

    return apiResponse.created(res, team.project.saved_views[team.project.saved_views.length - 1], 'Saved view created');
  } catch (error) { return next(error); }
};

const globalSearch = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return apiResponse.success(res, { teams: [], tasks: [], users: [] });

    const teams = await Team.find({
      $or: [{ team_name: { $regex: q, $options: 'i' } }, { 'project.title': { $regex: q, $options: 'i' } }, { 'project.modules.module_name': { $regex: q, $options: 'i' } }],
    }).select('_id team_name project.title project.modules').limit(10).lean();

    const users = await User.find({
      $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }],
    }).select('_id name email role').limit(10).lean();

    const tasks = [];
    teams.forEach((team) => {
      (team.project?.modules || []).forEach((module) => {
        if (new RegExp(q, 'i').test(module.module_name || '') || new RegExp(q, 'i').test(module.description || '')) {
          tasks.push({ team_id: team._id, team_name: team.team_name, module_id: module._id, module_name: module.module_name, status: module.status });
        }
      });
    });

    return apiResponse.success(res, { teams, tasks: tasks.slice(0, 20), users });
  } catch (error) { return next(error); }
};

module.exports = {
  getProjectBoard,
  addModuleEnhanced,
  bulkUpdateModules,
  addModuleComment,
  startTimer,
  stopTimer,
  getWorkload,
  getSprintAnalytics,
  getDashboard,
  createSavedView,
  globalSearch,
};
