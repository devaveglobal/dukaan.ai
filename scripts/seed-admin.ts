import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function findUserByEmail(email: string) {
  const perPage = 1000;

  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < perPage) return null;
  }

  return null;
}

async function seedAdmin() {
  const adminEmail = 'admin@aisales.com'.trim().toLowerCase();
  const adminPassword = 'AdminPassword123!'; // User should change this

  console.log('Seeding admin user...');

  // 1. Create user in auth.users
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    app_metadata: {
      password_set: true,
    },
    user_metadata: {
      role: 'admin',
      full_name: 'System Admin'
    }
  });

  if (userError) {
    if (userError.code === 'email_exists' || userError.message.includes('already registered')) {
      console.log('Admin user already exists.');
    } else {
      console.error('Error creating admin user:', {
        message: userError.message,
        code: userError.code,
        status: userError.status,
      });
      return;
    }
  } else {
    console.log('Admin user created successfully:', userData.user?.email);
  }

  // 2. Ensure profile has admin role (in case trigger didn't handle it or user already existed)
  const existingAdmin = await findUserByEmail(adminEmail);

  if (existingAdmin) {
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(existingAdmin.id, {
      app_metadata: {
        ...existingAdmin.app_metadata,
        password_set: true,
      },
      user_metadata: {
        ...existingAdmin.user_metadata,
        role: 'admin',
        full_name: 'System Admin',
      },
    });

    if (authUpdateError) {
      console.error('Error updating admin auth metadata:', authUpdateError.message);
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: existingAdmin.id,
        email: adminEmail,
        role: 'admin',
        full_name: 'System Admin',
        currency: 'Rs',
      });

    if (profileError) {
      console.error('Error updating admin profile:', profileError.message);
    } else {
      console.log('Admin profile verified/updated.');
    }
  }

  console.log('\n--- ADMIN CREDENTIALS ---');
  console.log(`Email: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
  console.log('--------------------------');
}

seedAdmin();
