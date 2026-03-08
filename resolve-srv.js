import dns from 'dns';

dns.resolveSrv('_mongodb._tcp.cluster0.xuspmih.mongodb.net', (err, addresses) => {
    if (err) {
        console.error('Error resolving SRV:', err);
        process.exit(1);
    }
    console.log('SRV Addresses:', JSON.stringify(addresses, null, 2));
    process.exit(0);
});
