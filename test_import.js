import * as controller from './controllers/subscriptionController.js';
console.log('Available exports:', Object.keys(controller));
if (controller.getPublicSubscriptionPlans) {
    console.log('getPublicSubscriptionPlans is exported!');
} else {
    console.log('getPublicSubscriptionPlans is MISSING!');
}
