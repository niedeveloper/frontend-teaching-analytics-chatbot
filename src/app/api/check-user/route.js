import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  const { email } = await req.json();

  const { data, error } = await supabase
    .from("users")
    .select("email")
    .eq("email", email);

  const allowedUsers = data.map((user) => user.email);
  console.log(allowedUsers);

  // const allowedUsers = [
  //   "chucmotngaytotlanh.tuananh@gmail.com",
  //   "nguyentuananh.kmf@gmail.com",
  //   "mike.nguyen0105@gmail.com",
  // ];
  if (allowedUsers.includes(email)) {
    return new Response(JSON.stringify({ allowed: true }), { status: 200 });
  }
  return new Response(JSON.stringify({ allowed: false }), { status: 403 });
}
