import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

// Models
import User from '../models/User.js';
import AppUser from '../models/AppUser.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';

const MONGO_URI = process.env.MONGO_URI;

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for seeding... 🔗');

        // Clear existing data
        await User.deleteMany({});
        await AppUser.deleteMany({});
        await Category.deleteMany({});
        await Product.deleteMany({});
        await SubscriptionPlan.deleteMany({});
        console.log('Cleared existing collections! 🗑️');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        // 1. Create Admin
        const admin = await User.create({
            name: 'Shrimpbite Admin',
            email: 'admin@shrimpbite.com',
            password: hashedPassword,
            role: 'admin',
            status: 'approved'
        });
        console.log('Admin created 👑');

        // 2. Create Retailers
        const retailers = await User.insertMany([
            {
                name: 'Fresh catch Hub',
                email: 'retailer1@shrimpbite.com',
                password: hashedPassword,
                role: 'retailer',
                status: 'approved',
                businessDetails: {
                    businessName: 'Fresh Catch Seafood',
                    businessType: 'Seafood Retail Store',
                    location: { city: 'Mumbai', state: 'Maharashtra' }
                }
            },
            {
                name: 'Sea Blue Frozen',
                email: 'retailer2@shrimpbite.com',
                password: hashedPassword,
                role: 'retailer',
                status: 'approved',
                businessDetails: {
                    businessName: 'Sea Blue Exports',
                    businessType: 'Distributor',
                    location: { city: 'Vizag', state: 'Andhra Pradesh' }
                }
            }
        ]);
        console.log('Retailers created 🏪');

        // 3. Create App Users (Customers)
        await AppUser.insertMany([
            {
                fullName: 'John Doe',
                email: 'john@example.com',
                phoneNumber: '9876543210',
                password: hashedPassword,
                isVerified: true
            },
            {
                fullName: 'Jane Smith',
                email: 'jane@example.com',
                phoneNumber: '9876543211',
                password: hashedPassword,
                isVerified: true
            }
        ]);
        console.log('App Users created 👥');

        // 4. Create Categories
        const categories = await Category.insertMany([
            { name: 'Fresh Fish' },
            { name: 'Shellfish' },
            { name: 'Frozen' }
        ]);
        console.log('Categories created 📂');

        // 5. Create Subscription Plans
        const plans = await SubscriptionPlan.insertMany([
            {
                name: 'Basic',
                description: 'Basic plan for occasional buyers',
                price: 0,
                billingCycle: 'Monthly',
                maxOrderQuantity: 10,
                features: ['Standard Delivery']
            },
            {
                name: 'Premium',
                description: 'Premium plan for regular seafood lovers',
                price: 499,
                billingCycle: 'Monthly',
                maxOrderQuantity: 50,
                features: ['Free Delivery', 'Priority Support'],
                bulkOrdersAllowed: true
            }
        ]);
        console.log('Subscription Plans created 💎');

        // 6. Create Products
        await Product.insertMany([
            {
                name: 'Tiger Prawns',
                description: 'Large, juicy tiger prawns, perfect for grilling.',
                price: 800,
                category: categories[1]._id, // Shellfish
                retailer: retailers[0]._id,
                stock: 100
            },
            {
                name: 'Rohu Fish',
                description: 'Fresh freshwater Rohu fish.',
                price: 350,
                category: categories[0]._id, // Fresh Fish
                retailer: retailers[0]._id,
                stock: 50
            },
            {
                name: 'Squid Rings',
                description: 'Frozen squid rings for frying.',
                price: 600,
                category: categories[2]._id, // Frozen
                retailer: retailers[1]._id,
                stock: 200
            }
        ]);
        console.log('Products created 🦐');

        console.log('Database seeded successfully! 🌱');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database: ❌', error);
        process.exit(1);
    }
};

seedData();
