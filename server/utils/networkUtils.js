const os = require('os');

/**
 * Dynamically detects the primary reachable IPv4 address on the host machine.
 * Prioritizes physical adapters (Wi-Fi, Ethernet) and filters out internal loopback,
 * link-local (169.254.x.x), and virtual switch/hypervisor adapters (VMware, VirtualBox, vEthernet).
 */
function getPrimaryLanIp() {
    return getAllLanIps()[0] || '127.0.0.1';
}

const PRIORITY_KEYWORDS = ['wi-fi', 'wifi', 'ethernet', 'eth', 'wlan', 'en'];
const VIRTUAL_KEYWORDS = ['vmware', 'virtual', 'loopback', 'default switch', 'vethernet', 'tailscale', 'hyper-v', 'docker'];

function isVirtualAdapter(name) {
    return VIRTUAL_KEYWORDS.some((kw) => name.includes(kw));
}

/**
 * Returns all physical (non-virtual) LAN IPv4 addresses, primary first.
 * Advertising every reachable address lets clients try each one, so device
 * pairing keeps working after the host switches networks (Wi-Fi <-> Ethernet).
 */
function getAllLanIps() {
    const interfaces = os.networkInterfaces();
    const priority = [];
    const others = [];
    const seen = new Set();

    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        const lowerName = name.toLowerCase();
        if (isVirtualAdapter(lowerName)) continue;

        const matchesPriority = PRIORITY_KEYWORDS.some((kw) => lowerName.includes(kw));
        for (const addr of addrs) {
            if (addr.family !== 'IPv4' || addr.internal || addr.address.startsWith('169.254.')) continue;
            if (seen.has(addr.address)) continue;
            seen.add(addr.address);
            if (matchesPriority) priority.push(addr.address);
            else others.push(addr.address);
        }
    }

    return [...priority, ...others];
}

module.exports = {
    getPrimaryLanIp,
    getAllLanIps
};
