export function requireAdmin(req, res, next) {
  if (req.session?.adminId) {
    next();
    return;
  }

  res.redirect('/admin/login');
}

export function exposeLocals(req, res, next) {
  res.locals.currentPath = req.path;
  res.locals.admin = req.session?.admin || null;
  next();
}

