exports.requireAuth = (req,res,next)=> req.user ? next() : res.status(401).json({error:'auth'});
exports.requireRole = role => (req,res,next)=> (req.user?.roles||[]).includes(role) ? next() : res.status(403).json({error:'forbidden'});

exports.ensureGAorSuper = (groupsColl)=> async (req,res,next)=>{
  const gid = req.params.id;
  const g = await groupsColl.findOne({ _id: new ObjectId(gid) });
  const uid = req.user?._id?.toString();
  const isGA = g?.admins?.includes(uid);
  const isSuper = (req.user?.roles||[]).includes('super');
  return (isGA || isSuper) ? next() : res.status(403).json({ error:'forbidden' });
};
