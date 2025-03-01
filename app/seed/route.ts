import bcrypt from "bcryptjs";
import postgres from "postgres";
import { invoices, customers, revenue, users } from "../lib/placeholder-data";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

// ✅ Initialize Extensions (Only Once)
async function initializeDatabase() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
}

// ✅ Seed Users Table
async function seedUsers(sql: postgres.TransactionSql<{}>) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `;

  return users.map(async (user) => {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    return sql`
      INSERT INTO users (id, name, email, password)
      VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword})
      ON CONFLICT (id) DO NOTHING;
    `;
  });
}

// ✅ Seed Customers Table
async function seedCustomers(sql: postgres.TransactionSql<{}>) {
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      image_url VARCHAR(255) NOT NULL
    );
  `;

  return customers.map((customer) => sql`
    INSERT INTO customers (id, name, email, image_url)
    VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.image_url})
    ON CONFLICT (id) DO NOTHING;
  `);
}

// ✅ Seed Invoices Table
async function seedInvoices(sql: postgres.TransactionSql<{}>) {
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `;

  return invoices.map((invoice) => sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})
    ON CONFLICT (id) DO NOTHING;
  `);
}

// ✅ Seed Revenue Table
async function seedRevenue(sql: postgres.TransactionSql<{}>) {
  await sql`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `;

  return revenue.map((rev) => sql`
    INSERT INTO revenue (month, revenue)
    VALUES (${rev.month}, ${rev.revenue})
    ON CONFLICT (month) DO NOTHING;
  `);
}

// ✅ Main Seeding Function (Handles Transactions)
export async function GET() {
  try {
    await initializeDatabase();

    await sql.begin(async (sql) => {
      await Promise.all([
        ...await seedUsers(sql),
        ...await seedCustomers(sql),
        ...await seedInvoices(sql),
        ...await seedRevenue(sql),
      ]);
    });

    return Response.json({ message: "Database seeded successfully" });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
