/**
 * AMOR E GELATTO - CONFIGURACAO DO SUPABASE (SINCRONIZADA)
 */
window.AMOR_E_GELATTO_CONFIG = {
  SUPABASE_URL: 'https://azymydyzdbbeiqitzkyl.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_85Yt8_gtrSIYI5PFc4YONQ_cgEoGFUV',
  isSupabaseConfigured() {
    return Boolean(this.SUPABASE_URL && this.SUPABASE_ANON_KEY && this.SUPABASE_URL.startsWith('https://'));
  }
};
