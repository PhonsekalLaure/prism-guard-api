async function rollbackProvisionedUser(supabaseAdmin, userId, context = 'provisioning') {
  if (!userId) return;

  const { error: profileDeleteError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (profileDeleteError) {
    console.error(`[${context} rollback] Failed to delete profile:`, profileDeleteError);
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    console.error(`[${context} rollback] Failed to delete auth user:`, authDeleteError);
  }
}

module.exports = {
  rollbackProvisionedUser,
};
