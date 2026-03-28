const AuditLog = require('../models/AuditLog');

const createAuditLog = async ({ actorId, action, targetType, targetId, details, req }) => {
  try {
    await AuditLog.create({
      actor: actorId,
      action,
      targetType,
      targetId,
      details,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (_err) {
    // best-effort logging
  }
};

module.exports = { createAuditLog };
