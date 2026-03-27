import app from '../app.js';
import request from 'supertest'; // I should check if supertest is available, otherwise use a simpler method

// Since I might not have supertest, I'll just check the stack
const routes = [];

function print(path, layer) {
  if (layer.route) {
    layer.route.stack.forEach(print.bind(null, path + layer.route.path));
  } else if (layer.name === 'router' && layer.handle.stack) {
    layer.handle.stack.forEach(print.bind(null, path + (layer.regexp.source.replace('\\/?(?=\\/|$)', '').replace('^', '').replace('\\/', '/'))));
  } else if (layer.method) {
    routes.push(layer.method.toUpperCase() + ' ' + path);
  }
}

app._router.stack.forEach(print.bind(null, ''));

const criticalRoutes = [
    'POST /app/register',
    'GET /wallet/history',
    'GET /app/shops',
    'GET /wallet/balance',
    'GET /app/profile',
    'GET /app/categories',
    'GET /app/address',
    'GET /',
    'GET /app/orders/my',
    'GET /orders/my'
];

console.log("Registered Routes Check:");
criticalRoutes.forEach(r => {
    const found = routes.some(registered => registered.includes(r));
    console.log(`${found ? '✅' : '❌'} ${r}`);
});

process.exit(0);
