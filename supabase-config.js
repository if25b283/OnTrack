import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://twulcygrmhcpbrqbiicj.supabase.co'

const supabaseKey = 'sb_publishable_XJAs5twlqhHoK6ezONsQbg_vYG4LxOj'

const supabase = createClient(supabaseUrl, supabaseKey)

export { supabase }