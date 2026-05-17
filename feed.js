import { supabase } from "./supabase-config.js";

const { data: { user } } = await supabase.auth.getUser();

if (!user) {
    window.location.href = "login.html";
}