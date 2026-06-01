// Shared blog posts data — used by blog.html and blog-post.html
// Posts are static; metrics (views, likes, votes) are stored in MongoDB via /api/blog/meta

const blogPosts = [
  {
    id: 'p1',
    title: 'How to Safely Format a Flash Disk Without Losing Important Data',
    category: 'How-To',
    tag: 'How-To',
    emoji: '💾',
    color: '#00d4ff',
    featured: true,
    readTime: '3 min read',
    date: new Date(Date.now() - 2*60*1000),
    views: 1240,
    likes: 87,
    excerpt: 'Formatting a flash disk incorrectly can wipe data you needed. Learn the right way to format safely — including how to back up, choose the correct file system, and avoid common mistakes.',
    body: `<p><strong>Flash disks are one of the most used storage devices</strong> in Kenya, but many people lose data by formatting them the wrong way. Follow these steps carefully and you'll never lose important files again.</p>
<p><strong>Step 1 — Back up your files first.</strong> Before anything else, copy all files you want to keep onto your computer or another drive. Never format first and ask questions later.</p>
<p><strong>Step 2 — Identify the right file system.</strong> For flash disks used between Windows and Mac, choose <strong>exFAT</strong>. For Windows-only use, choose <strong>NTFS</strong>. FAT32 works everywhere but can't handle files larger than 4GB.</p>
<p><strong>Step 3 — Open Disk Management on Windows.</strong> Right-click "This PC" → Manage → Disk Management. Find your flash disk by its size, right-click the partition, and select "Format."</p>
<p><strong>Step 4 — Choose "Quick Format" only if the drive is healthy.</strong> A full format checks for bad sectors — use it if the drive has been behaving strangely.</p>
<div class="tip-box"><strong>💡 Pro Tip:</strong> If you accidentally formatted already, stop using the drive immediately and use recovery software like Recuva (free) — the sooner, the better chance of recovery.</div>
<p><strong>Step 5 — Safely eject after formatting.</strong> Always use "Safely Remove Hardware" before pulling the flash disk out. Ejecting without this step can corrupt the file system.</p>
<p>With these steps, you'll format cleanly every time and protect your data from unnecessary loss.</p>`
  },
  {
    id: 'p2',
    title: 'Top 5 Signs Your Laptop Battery Needs Replacing Right Now',
    category: 'Devices',
    tag: 'Devices',
    emoji: '🔋',
    color: '#ff6b35',
    featured: false,
    readTime: '2 min read',
    date: new Date(Date.now() - 45*60*1000),
    views: 892,
    likes: 64,
    excerpt: 'Is your laptop dying faster than it used to? Here are 5 clear warning signs that your battery is failing — and what to do before it leaves you stranded.',
    body: `<p><strong>A failing laptop battery is one of the most frustrating ICT problems</strong> — especially when it happens without warning. Knowing the signs early saves you money and stress.</p>
<p><strong>Sign 1 — Battery drains in under an hour.</strong> A healthy laptop should last 3–6 hours on a charge. If yours dies within 45–60 minutes, the battery cells are degrading.</p>
<p><strong>Sign 2 — The laptop shuts off suddenly at 20–30%.</strong> This means the battery's reported capacity no longer matches its actual capacity. It's a classic sign of cell failure.</p>
<p><strong>Sign 3 — The battery only charges to 60–70%.</strong> Batteries have charge cycles. After 500+ cycles, many batteries can no longer reach 100% — this is normal ageing but signals replacement time.</p>
<p><strong>Sign 4 — Your laptop gets unusually hot near the battery.</strong> A swelling or overheating battery is dangerous. Stop using the laptop immediately and have it checked — a swollen battery can rupture.</p>
<div class="tip-box"><strong>⚠️ Safety Warning:</strong> Never use a visibly bulging battery. The lithium cells inside can catch fire. Replace it urgently at a certified technician.</div>
<p><strong>Sign 5 — Windows or macOS shows "Consider replacing your battery."</strong> Your OS monitors battery health. When you see this message, it's time to act.</p>
<p>Visit any <strong>SELA branch</strong> across Mombasa and Nairobi to get your battery assessed and replaced with quality parts.</p>`
  },
  {
    id: 'p3',
    title: 'WiFi vs Ethernet: Which Is Better for Working From Home in Kenya?',
    category: 'Networking',
    tag: 'Networking',
    emoji: '📡',
    color: '#00e676',
    featured: false,
    readTime: '3 min read',
    date: new Date(Date.now() - 3*60*60*1000),
    views: 2103,
    likes: 156,
    excerpt: 'WiFi is convenient, but Ethernet almost always wins on speed and stability. This guide breaks down the real differences and helps you choose for your home setup.',
    body: `<p><strong>With more Kenyans working remotely, the question of WiFi vs Ethernet has never been more relevant.</strong> Let's break down both options clearly.</p>
<p><strong>WiFi — Convenient but inconsistent.</strong> WiFi lets you move freely around your home. However, walls, microwaves, and neighbours' networks cause interference that drops your speeds unpredictably.</p>
<p><strong>Ethernet — Stable and fast.</strong> A direct cable connection to your router delivers consistent speeds with virtually zero packet loss. For video calls, large uploads, and gaming, Ethernet wins every time.</p>
<p><strong>Speed comparison.</strong> On a typical Safaricom 30Mbps home fibre plan, WiFi delivers roughly 18–22Mbps due to interference. Ethernet on the same plan delivers the full 28–30Mbps consistently.</p>
<p><strong>Latency matters for calls.</strong> Zoom and Google Meet rely on low latency. Ethernet typically gives 5–15ms latency; WiFi can spike to 50–120ms during heavy usage — which causes that awkward "lagging" during calls.</p>
<div class="tip-box"><strong>💡 Best of Both Worlds:</strong> Connect your desktop or laptop via Ethernet for work tasks and keep WiFi for phones and tablets. A simple Cat6 cable and a wall adapter is all you need.</div>
<p><strong>What to buy.</strong> For Ethernet, get a Cat6 cable (available at SELA branches from KES 150 per metre). For better WiFi, upgrade to a WiFi 6 router — our TP-Link AX3000 covers up to 2500 sq ft with minimal dead zones.</p>
<p>Choose Ethernet for serious work. Use WiFi for convenience. Both together is the ideal setup.</p>`
  },
  {
    id: 'p4',
    title: '7 Cybersecurity Habits Every Kenyan Internet User Must Have',
    category: 'Security',
    tag: 'Security',
    emoji: '🛡️',
    color: '#a855f7',
    featured: false,
    readTime: '4 min read',
    date: new Date(Date.now() - 24*60*60*1000),
    views: 3450,
    likes: 241,
    excerpt: 'Cyber attacks are rising fast in East Africa. From phishing WhatsApp messages to M-Pesa fraud, here are 7 simple habits that will protect you online.',
    body: `<p><strong>Kenya is among Africa's top targets for cybercrime,</strong> with mobile money fraud and phishing attacks surging every year. These 7 habits will protect you significantly.</p>
<p><strong>1. Use strong, unique passwords.</strong> Never reuse passwords across accounts. A good password is 12+ characters mixing uppercase, numbers, and symbols. Use a password manager like Bitwarden (free) to remember them.</p>
<p><strong>2. Enable Two-Factor Authentication (2FA).</strong> Turn on 2FA on your Gmail, Facebook, and M-Pesa linked accounts. Even if someone steals your password, they can't log in without the second code.</p>
<p><strong>3. Never click suspicious links on WhatsApp.</strong> Most Kenyan scams arrive via WhatsApp — "You've won a prize!" or "Verify your account." When in doubt, don't click. Call the company directly instead.</p>
<p><strong>4. Update your software regularly.</strong> Software updates patch security holes. Delaying updates leaves your phone or laptop vulnerable to known attacks. Enable automatic updates on Android, iOS, and Windows.</p>
<div class="tip-box"><strong>🛡️ Quick Win:</strong> Go to your phone's Settings → Software Update right now. If there's a pending update, install it today — it takes 10 minutes and could prevent a serious breach.</div>
<p><strong>5. Use a VPN on public WiFi.</strong> Coffee shops, hotels, and airports have unsecured networks. A VPN encrypts your traffic so no one on the same network can read your data.</p>
<p><strong>6. Back up your data to the cloud.</strong> If ransomware hits your device, a recent backup is your best defence. Use Google Drive, iCloud, or OneDrive — all have free tiers.</p>
<p><strong>7. Be careful what you plug in.</strong> Unknown USB flash disks can install malware the moment they're inserted. Only plug in drives you trust or bought from a reliable source like SELA.</p>`
  },
  {
    id: 'p5',
    title: 'How to Choose the Right Wireless Mouse for Your Office Work',
    category: 'Buying Guide',
    tag: 'Buying Guide',
    emoji: '🖱️',
    color: '#f59e0b',
    featured: false,
    readTime: '2 min read',
    date: new Date(Date.now() - 2*24*60*60*1000),
    views: 678,
    likes: 43,
    excerpt: 'Not all wireless mice are equal. DPI, battery life, connectivity type — these specs actually matter. Here\'s a simple buying guide to pick the right one for office use.',
    body: `<p><strong>A good wireless mouse makes a real difference</strong> to your daily comfort and productivity. Here's what to look for before you buy.</p>
<p><strong>DPI (Dots Per Inch) — the sensitivity setting.</strong> For general office work on a normal screen, 800–1200 DPI is comfortable. Graphic designers may prefer 2000+ DPI for precision. Most mice let you switch between DPI settings with a button.</p>
<p><strong>Battery life matters more than you think.</strong> Cheap mice need recharging every 3–5 days. Look for models with at least 3 months on AA batteries or a built-in rechargeable battery with USB-C charging.</p>
<p><strong>Connection type: Bluetooth vs 2.4GHz dongle.</strong> Bluetooth saves a USB port and works across multiple devices. A 2.4GHz dongle is slightly faster with lower latency — better for precise work. Some premium mice offer both.</p>
<p><strong>Ergonomics — don't ignore this.</strong> If you use a mouse 6+ hours a day, a poorly shaped mouse causes wrist pain over time. For right-hand users, a sculpted ergonomic design reduces strain significantly.</p>
<div class="tip-box"><strong>🛒 Our Recommendation:</strong> The Logitech MX Master 3 available at SELA (KES 4,500) is the gold standard for office use — rechargeable, precise, and ergonomic. For budget buyers, the Logitech M185 at KES 1,200 is reliable and long-lasting.</div>
<p><strong>Scroll wheel type.</strong> A free-spinning scroll wheel is great for long documents and spreadsheets. A clicky ratchet wheel gives more control. Some mice have both modes.</p>
<p>Come into any SELA branch and our team will help you pick the right mouse for your specific workflow and budget.</p>`
  },
  {
    id: 'p6',
    title: 'USB-A vs USB-C: The Complete Difference Explained Simply',
    category: 'Tips',
    tag: 'Tips',
    emoji: '🔌',
    color: '#14b8a6',
    featured: false,
    readTime: '2 min read',
    date: new Date(Date.now() - 4*24*60*60*1000),
    views: 1876,
    likes: 119,
    excerpt: 'USB-C is everywhere now but many people are still confused about the difference. This simple guide explains speeds, charging, and when to use which connector.',
    body: `<p><strong>USB confusion is real — and it costs people money.</strong> You buy a cable that doesn't fit, or charge your phone slowly because you grabbed the wrong one. Let's fix that.</p>
<p><strong>USB-A — the rectangular one.</strong> This is the classic USB port you've used for years. It only fits one way and supports older USB 2.0 and 3.0 speeds. Most older laptops, chargers, and accessories use USB-A.</p>
<p><strong>USB-C — the oval, reversible one.</strong> USB-C is the modern standard. It fits either way up, carries more power, transfers data faster, and can even output video to monitors. Virtually all new phones, laptops, and tablets use USB-C.</p>
<p><strong>Speed differences.</strong> USB-A (3.0) transfers at up to 5 Gbps. USB-C with USB 3.2 reaches 20 Gbps. For moving large video files or backups, this difference is very noticeable.</p>
<p><strong>Charging speed.</strong> USB-A chargers typically deliver 5–12W. USB-C with Power Delivery (PD) can deliver up to 100W — enough to charge a laptop. Always check the wattage on your charger brick.</p>
<div class="tip-box"><strong>💡 Important:</strong> Not all USB-C cables are equal. A cheap USB-C cable might only carry power and slow USB 2.0 speeds, not the full USB 3.2 or Thunderbolt speeds. Always buy quality cables from a trusted source.</div>
<p><strong>What to buy today.</strong> If you're buying a new cable, get USB-C to USB-C with at least 60W support. Our Samsung braided cables at SELA support 65W and 10 Gbps data — perfect for modern devices.</p>
<p>When in doubt, bring your device to any SELA branch and we'll match you with the right cable.</p>`
  },
  {
    id: 'p7',
    title: 'How to Speed Up a Slow Windows PC in 10 Minutes',
    category: 'Tips',
    tag: 'Tips',
    emoji: '⚡',
    color: '#f59e0b',
    featured: false,
    readTime: '3 min read',
    date: new Date(Date.now() - 7*24*60*60*1000),
    views: 4210,
    likes: 302,
    excerpt: 'Before you spend money on a new PC, try these 5 quick fixes that regularly bring slow Windows machines back to life — no technical skills needed.',
    body: `<p><strong>A slow PC is one of the most common complaints in offices across Kenya.</strong> Before buying a new one, try these five fixes — they work surprisingly often.</p>
<p><strong>Fix 1 — Disable startup programmes.</strong> Press Ctrl+Shift+Esc to open Task Manager → click the "Startup" tab → right-click and disable anything you don't need starting with Windows. This alone can cut boot time in half.</p>
<p><strong>Fix 2 — Clear your temporary files.</strong> Press Windows Key + R, type <strong>%temp%</strong>, press Enter, and delete everything in that folder. These leftover files waste space and slow your system down.</p>
<p><strong>Fix 3 — Check for malware.</strong> Many slow PCs are secretly running malware in the background. Open Windows Defender (built-in and free) and run a full scan. Remove whatever it finds.</p>
<p><strong>Fix 4 — Upgrade your RAM.</strong> If your PC has 4GB of RAM and you run Chrome with 10 tabs, it will always feel slow. Upgrading to 8GB or 16GB RAM is the single most cost-effective hardware upgrade — often under KES 3,500.</p>
<div class="tip-box"><strong>💡 Quick Check:</strong> Open Task Manager (Ctrl+Shift+Esc) → Performance tab. If RAM usage is always above 80%, a RAM upgrade will make an enormous difference to your daily experience.</div>
<p><strong>Fix 5 — Switch to an SSD.</strong> If your PC still has an old spinning hard drive (HDD), replacing it with an SSD is the most dramatic speed upgrade possible. Boot times drop from 2–3 minutes to under 20 seconds.</p>
<p>SELA stocks RAM and SSD upgrades at all branches. Our team can install them for you on the spot.</p>`
  },
  {
    id: 'p8',
    title: 'What Is a VPN and Do You Actually Need One in Kenya?',
    category: 'Security',
    tag: 'Security',
    emoji: '🔐',
    color: '#a855f7',
    featured: false,
    readTime: '3 min read',
    date: new Date(Date.now() - 10*24*60*60*1000),
    views: 2890,
    likes: 178,
    excerpt: 'VPNs are popular but often misunderstood. This guide explains clearly what a VPN does, what it doesn\'t do, and whether you genuinely need one in Kenya.',
    body: `<p><strong>VPN stands for Virtual Private Network.</strong> It creates an encrypted tunnel between your device and the internet, hiding your traffic from your ISP, hackers, and some surveillance systems.</p>
<p><strong>What a VPN actually does.</strong> It masks your real IP address (which reveals your location), encrypts your internet traffic on public WiFi, and lets you appear to browse from another country.</p>
<p><strong>What a VPN does NOT do.</strong> It does not make you anonymous online. If you log into Google or Facebook, those companies still know who you are. A VPN is privacy, not invisibility.</p>
<p><strong>When you genuinely need a VPN in Kenya.</strong> Using public WiFi at a café, hotel, or airport — a VPN prevents others on the network from intercepting your data. If you access work systems remotely, your company's VPN is a security requirement.</p>
<p><strong>For accessing content.</strong> Some streaming platforms and business tools are region-locked. A VPN with a US or UK server lets you access content not available in Kenya.</p>
<div class="tip-box"><strong>🛡️ Recommendation:</strong> For personal use, ProtonVPN has a solid free tier. For business or heavy use, NordVPN or ExpressVPN offer reliable performance with servers in nearby African regions.</div>
<p><strong>Does a VPN slow your internet?</strong> Yes, slightly — typically 10–20% speed reduction due to encryption overhead. On a fast fibre connection, this is barely noticeable.</p>
<p>For businesses handling sensitive customer data, SELA offers enterprise VPN setup as part of our network connectivity solutions — contact us to discuss your needs.</p>`
  }
,
  {
    id: 'p9',
    title: 'MikroTik Hotspot Setup: The Complete Professional Guide for Kenyan Businesses',
    category: 'Networking',
    tag: 'Networking',
    emoji: '🔥',
    color: '#00e676',
    featured: true,
    readTime: '6 min read',
    date: new Date(Date.now() - 1*24*60*60*1000),
    views: 3820,
    likes: 274,
    excerpt: 'MikroTik is the backbone of most Kenyan hotspot businesses. This complete guide covers router configuration, voucher billing, bandwidth management, and securing your network from intrusion.',
    tags: ['router','connectivity','WiFi','tutorial','networking'],
    body: `<p><strong>MikroTik routers power thousands of hotspot businesses across Kenya</strong> — from cyber cafés to hotel WiFi to shopping mall internet kiosks. This guide walks you through a professional setup from scratch.</p><h3>What You Need</h3><ul><li>MikroTik hAP ac² or RB951Ui-2HnD router</li><li>A computer with Winbox installed (free MikroTik management tool)</li><li>Active internet connection from your ISP</li></ul><h3>Step 1 — Initial Router Access</h3><p>Connect your computer to the MikroTik via Ethernet on port 2–5. Open Winbox and click the Neighbours tab. Your router will appear — click its MAC address to connect. Default login: admin / blank password. Change this immediately.</p><h3>Step 2 — Configure WAN Interface</h3><p>Go to IP → DHCP Client → Add. Select your WAN interface (ether1) and enable it. Your router will get an IP from your ISP automatically. Test connectivity by pinging 8.8.8.8 from the terminal.</p><h3>Step 3 — Create the Hotspot</h3><p>Go to IP → Hotspot → Hotspot Setup. Select your LAN interface (bridge), set the IP range (192.168.10.0/24), configure DNS as 8.8.8.8, and follow the wizard. Your captive portal login page activates immediately.</p><h3>Step 4 — Voucher Billing System</h3><p>Go to IP → Hotspot → Users to create profiles: 1hr-KES50, 3hr-KES100, daily-KES200. Use the User Manager module to generate printable voucher batches automatically. Customers enter the code on the login page to connect.</p><h3>Step 5 — Bandwidth Management</h3><p>Go to Queues → Simple Queues and create per-profile rules. For example: the 1hr plan receives max 5Mbps down / 2Mbps up. This prevents any single user from saturating your connection.</p><div class="tip-box"><strong>💡 Pro Tip:</strong> Enable Hotspot → Walled Garden to let users preview your business website or social media before paying. This increases customer conversions significantly.</div><h3>Step 6 — Security Hardening</h3><p>Change the admin password immediately. Disable Telnet and FTP under IP → Services. Add a firewall rule to drop invalid connections. Enable HTTPS for your hotspot login page to protect user credentials.</p><p>SELA provides <strong>professional MikroTik hotspot setup</strong> at all branches from KES 2,000. We supply hardware, configure it, and train your team.</p>`
  },
  {
    id: 'p10',
    title: 'CCTV Installation Guide: What Every Kenyan Home and Business Owner Must Know',
    category: 'How-To',
    tag: 'How-To',
    emoji: '📹',
    color: '#00d4ff',
    featured: false,
    readTime: '5 min read',
    date: new Date(Date.now() - 2*24*60*60*1000),
    views: 2640,
    likes: 189,
    excerpt: 'CCTV is no longer just for big businesses. This guide covers camera types, placement angles, DVR vs NVR, remote viewing setup, and what to avoid when buying cheap cameras in Kenya.',
    tags: ['hardware','ICT','tutorial','step-by-step','privacy'],
    body: `<p><strong>Security cameras have dropped dramatically in price,</strong> making CCTV accessible for homes, shops, and offices across Kenya. But the wrong equipment wastes thousands of shillings. Here is everything you need to know before buying.</p><h3>Analog CCTV vs IP Cameras</h3><p><strong>Analog cameras</strong> connect to a DVR via coaxial cable. Cheaper but limited to 1080p and require heavy cable runs. <strong>IP cameras</strong> connect over your existing network to an NVR. They support 4K, remote access, AI motion detection, and are far easier to expand. Recommended for all new installations.</p><h3>How Many Cameras Do You Need?</h3><p>For a shop: 1 at entrance, 1 at the counter/till, 1 covering the main floor. For a home: 1 at each exit and 1 overlooking the compound. Start with 4 minimum.</p><h3>Placement Rules</h3><ul><li>Mount cameras at a downward angle of 15–30 degrees for best facial capture</li><li>Entrance cameras should go 2.5–3 metres high, covering the full doorway</li><li>Never point cameras directly into sunlight — it creates silhouettes, not usable footage</li></ul><div class="tip-box"><strong>⚠️ Common Mistake:</strong> Never buy cameras based on megapixels alone. A poorly placed 8MP camera captures less useful footage than a well-placed 2MP camera. Placement is everything.</div><h3>Remote Viewing Setup</h3><p>All modern NVRs support remote viewing via apps like Hik-Connect, DMSS, or XMEye. Connect your NVR to your router, forward ports 8000 and 554, then add the device using your DDNS address or public IP.</p><h3>Storage Requirements</h3><p>For 4 cameras recording 24/7 at 1080p, a 2TB hard drive stores approximately 15–20 days of footage. Always use surveillance-grade drives (WD Purple, Seagate SkyHawk) — standard desktop drives fail quickly under 24/7 operation.</p><p>SELA installs CCTV systems from <strong>KES 3,000</strong> including mounting, cabling, DVR/NVR configuration, and remote viewing setup at all branches.</p>`
  },
  {
    id: 'p11',
    title: 'Windows 11 vs Windows 10: Which Should You Use in 2025?',
    category: 'Tips',
    tag: 'Tips',
    emoji: '🪟',
    color: '#f59e0b',
    featured: false,
    readTime: '4 min read',
    date: new Date(Date.now() - 3*24*60*60*1000),
    views: 3180,
    likes: 231,
    excerpt: 'Microsoft pushed Windows 11 hard, but is it worth upgrading? We compare performance, hardware requirements, and whether older Kenyan office hardware can even run it.',
    tags: ['performance','tutorial','tricks','hardware','ICT'],
    body: `<p><strong>Windows 11 has been available for years, yet millions are still on Windows 10.</strong> Should you upgrade? The honest answer depends entirely on your hardware.</p><h3>The Hardware Requirement Dealbreaker</h3><p>Windows 11 requires a <strong>TPM 2.0 chip</strong> and an <strong>8th-generation Intel or Ryzen 2000</strong> CPU or newer. This excludes a huge number of laptops in Kenyan offices — anything older than 2018 generally cannot run Windows 11 officially.</p><h3>Performance: Who Actually Wins?</h3><p>On supported hardware, Windows 11 is marginally faster for gaming due to DirectStorage. For office work — documents, spreadsheets, email, web browsing — the difference is imperceptible. Both perform identically for typical business use.</p><h3>Interface Changes to Know</h3><p>Windows 11 centres the Start menu (you can move it back), removes some right-click options, and reorganises Settings. The interface is cleaner but takes time to relearn if you've used Windows 10 for years.</p><div class="tip-box"><strong>💡 Our Verdict:</strong> If your hardware supports it, upgrade to Windows 11 — it's free and receives longer support. If not, stay on Windows 10 (supported until October 2025) and invest in an SSD upgrade instead.</div><h3>Security Improvements</h3><p>Windows 11's TPM 2.0 requirement enables Secure Boot and hardware-level encryption by default. For businesses handling sensitive customer data, this is a meaningful security improvement over Windows 10.</p><h3>Windows 10 End of Life: October 2025</h3><p>Microsoft ends free Windows 10 security updates in October 2025. After this, you'll need to upgrade hardware, pay for Extended Security Updates, or switch to Linux. Start planning now.</p><p>SELA installs <strong>genuine Windows 10 and Windows 11</strong> at all branches from KES 500. We verify your hardware compatibility before you commit.</p>`
  },
  {
    id: 'p12',
    title: 'LAN vs WAN vs MAN: Computer Networks Explained Simply',
    category: 'Networking',
    tag: 'Networking',
    emoji: '🌐',
    color: '#00e676',
    featured: false,
    readTime: '4 min read',
    date: new Date(Date.now() - 4*24*60*60*1000),
    views: 1950,
    likes: 143,
    excerpt: 'LAN, WAN, MAN — these terms appear everywhere in networking but are rarely explained clearly. This guide uses real Kenyan examples to make each concept instantly understandable.',
    tags: ['LAN','ethernet','router','connectivity','tutorial'],
    body: `<p><strong>Understanding network types is fundamental to ICT</strong> — whether you're setting up an office, studying for a certification, or troubleshooting connectivity issues.</p><h3>LAN — Local Area Network</h3><p>A LAN connects devices within a small area: a room, building, or campus. Your home WiFi router creates a LAN. All devices in a Nairobi law firm connected via Ethernet or WiFi form a LAN.</p><p><strong>Speed:</strong> Modern LANs operate at 1 Gbps (Ethernet) or 600+ Mbps (WiFi 6). Internal file transfers across a LAN are far faster than your internet connection.</p><h3>WAN — Wide Area Network</h3><p>A WAN spans large geographic areas — cities, countries, or the entire globe. The internet is the largest WAN. When your Nairobi office connects to a server in Mombasa, that traffic crosses a WAN. Safaricom's data network is a WAN.</p><div class="tip-box"><strong>💡 Key Distinction:</strong> Your Safaricom fibre speed (e.g. 30Mbps) is your WAN speed. Your internal office transfer speed (1 Gbps via Ethernet) is your LAN speed. They are completely independent.</div><h3>MAN — Metropolitan Area Network</h3><p>A MAN covers a city or large campus — bigger than a LAN, smaller than a WAN. The University of Nairobi connecting its main campus, medical school, and hostels via high-speed fibre is a MAN. County government networks are also MANs.</p><h3>Practical Application</h3><p>For your business: optimise your LAN first — use Ethernet where possible and upgrade to WiFi 6. A fast WAN (internet) connected to a poorly configured LAN still delivers a frustrating user experience. Fix the LAN before complaining about Safaricom.</p><p>SELA designs and installs LAN infrastructure for businesses at all branches. Contact us for a free network assessment.</p>`
  },
  {
    id: 'p13',
    title: 'Laptop Buying Guide 2025: What to Look For Under KES 60,000 in Kenya',
    category: 'Buying Guide',
    tag: 'Buying Guide',
    emoji: '💻',
    color: '#f59e0b',
    featured: true,
    readTime: '5 min read',
    date: new Date(Date.now() - 5*24*60*60*1000),
    views: 5420,
    likes: 387,
    excerpt: 'Buying a laptop in Kenya is confusing — local prices are high, specs are often inflated, and the market is full of overpriced mediocre hardware. Here is exactly what to look for.',
    tags: ['buying-guide','laptop','review','value-for-money','peripherals'],
    body: `<p><strong>Buying a laptop in Kenya under KES 60,000</strong> requires careful navigation. This guide cuts through the noise and tells you exactly what matters.</p><h3>Priority 1 — Always Get SSD, Never HDD</h3><p>This is non-negotiable. A laptop with a traditional hard disk drive will feel painfully slow in 2025 regardless of processor power. Demand a minimum <strong>256GB SSD</strong>. An old Core i5 with SSD outperforms a new Core i7 with HDD for daily tasks.</p><h3>Priority 2 — RAM: 8GB Minimum</h3><p>With 4GB RAM, your laptop struggles with Chrome, Word, and WhatsApp Web simultaneously. Aim for <strong>8GB DDR4</strong> minimum. For video editing or virtual machines, 16GB is essential.</p><h3>Priority 3 — Processor Generation Matters More Than Brand</h3><p>Intel Core i5 <strong>10th generation or newer</strong> (or AMD Ryzen 5 4000 series+) is the sweet spot for most users. Avoid anything older than 8th generation — they don't support Windows 11 and are increasingly slow by modern standards.</p><div class="tip-box"><strong>⚠️ Red Flag:</strong> If someone advertises a Core i7 laptop for under KES 25,000, it's almost certainly a 6th or 7th generation chip. Always check the generation number, not just the i3/i5/i7 branding.</div><h3>Best Value Under KES 60,000</h3><ul><li><strong>Under KES 30,000:</strong> Refurbished Dell Latitude or ThinkPad (i5, 8GB, 256GB SSD) with 3-month warranty from SELA</li><li><strong>KES 35,000–50,000:</strong> New Lenovo IdeaPad or HP 15s — reliable, widely serviced</li><li><strong>KES 50,000–60,000:</strong> ASUS VivoBook 15 or Acer Aspire 5 — IPS display, good build quality</li></ul><p>Visit any SELA branch with this guide. Our team will match you with the right laptop for your budget without overselling.</p>`
  },
  {
    id: 'p14',
    title: 'USB Flash Disk vs External SSD vs Cloud: Which Storage Should You Use?',
    category: 'Tips',
    tag: 'Tips',
    emoji: '💿',
    color: '#f59e0b',
    featured: false,
    readTime: '4 min read',
    date: new Date(Date.now() - 6*24*60*60*1000),
    views: 2310,
    likes: 167,
    excerpt: 'Flash disk, external SSD, or cloud storage — each has a completely different purpose. This comparison of speed, price, durability and use cases will tell you exactly which to buy.',
    tags: ['USB','tricks','performance','value-for-money','tips'],
    body: `<p><strong>Every Kenyan professional has wrestled with the storage question.</strong> The honest answer: each option has a different purpose, and knowing which to use prevents both data loss and wasted money.</p><h3>USB Flash Disk</h3><p><strong>Best for:</strong> Moving small files between devices, sharing documents, presentations, temporary storage.</p><p><strong>Speed:</strong> USB 2.0 (cheap drives) transfers at 10–25 MB/s. USB 3.1 drives reach 100–200 MB/s. Always buy USB 3.0 minimum in 2025 — the difference is enormous.</p><p><strong>Price in Kenya:</strong> KES 350–2,500. SELA stocks Transcend and Samsung USB 3.1 drives. Avoid unbranded drives — they fail without warning and often damage data.</p><h3>External SSD</h3><p><strong>Best for:</strong> Video editors, photographers, developers — anyone moving large files regularly or needing fast portable storage.</p><p><strong>Speed:</strong> SATA external SSDs hit 500 MB/s. NVMe enclosures with USB 3.2 Gen 2 reach 1,000+ MB/s. A 10GB video copies in under 15 seconds.</p><p><strong>Price:</strong> A 500GB Samsung T7 costs around KES 7,500 — worth it if you work with large files daily.</p><div class="tip-box"><strong>💡 Rule of Thumb:</strong> If you're moving files larger than 4GB regularly, a flash disk will frustrate you. Get an external SSD.</div><h3>Cloud Storage</h3><p><strong>Best for:</strong> Automatic backups, accessing files across multiple devices, team collaboration.</p><p><strong>Free tiers:</strong> Google Drive (15GB), OneDrive (5GB). Google One gives 100GB for KES 350/month.</p><p><strong>Kenyan challenge:</strong> Cloud requires reliable internet. On Safaricom fibre, it's excellent. On 4G data, uploading large files eats your bundle fast.</p><h3>The Professional Setup</h3><p>Use a <strong>flash disk</strong> for quick transfers. Use an <strong>external SSD</strong> as your working drive. Use <strong>cloud storage</strong> for critical documents and backups. All three together gives you bulletproof data security.</p>`
  },
  {
    id: 'p15',
    title: 'How to Protect Your Privacy Online in 2025: A Practical Step-by-Step Guide',
    category: 'Security',
    tag: 'Security',
    emoji: '🔒',
    color: '#a855f7',
    featured: false,
    readTime: '5 min read',
    date: new Date(Date.now() - 8*24*60*60*1000),
    views: 2890,
    likes: 201,
    excerpt: 'Your smartphone and apps collect more data than you realise. This no-nonsense guide shows you exactly how to audit your permissions, choose private tools, and take back control.',
    tags: ['privacy','password','VPN','cybersecurity','tips'],
    body: `<p><strong>Digital privacy in 2025 is not paranoia — it is necessity.</strong> Every app, every search, and every site you visit is tracked and monetised. Here is how to dramatically reduce your exposure.</p><h3>1. Audit App Permissions Right Now</h3><p>On Android: Settings → Apps → select any app → Permissions. On iPhone: Settings → Privacy. You will find apps with microphone, camera, and location access that have no business having them. Revoke permissions aggressively — most apps work fine without them.</p><h3>2. Use a Password Manager</h3><p>Password reuse is the single biggest cause of account takeovers. Install <strong>Bitwarden</strong> (free, open-source) and let it generate 20-character random passwords for every site. You only need to remember one master password.</p><h3>3. Switch to a Privacy Browser</h3><p>Chrome shares your browsing data with Google. Switch to <strong>Firefox</strong> with the uBlock Origin extension, or use <strong>Brave</strong>. Both block trackers by default and load pages significantly faster.</p><div class="tip-box"><strong>💡 Quick Win:</strong> Install uBlock Origin in your browser right now. It blocks 90% of trackers and makes every page load faster — takes 2 minutes to install.</div><h3>4. Enable Encrypted Messaging</h3><p>WhatsApp uses end-to-end encryption by default. Regular SMS does not. For sensitive business communications, use <strong>Signal</strong> — the gold standard for secure messaging used by security professionals worldwide.</p><h3>5. Check If You've Been Breached</h3><p>Go to <strong>haveibeenpwned.com</strong> and enter your email. It shows every data breach your email appeared in. If the password from that breach matches what you currently use anywhere, change it immediately.</p><h3>6. Encrypt Your Phone</h3><p>Modern Android and iPhone devices encrypt storage by default when you set a PIN. If your phone has no PIN or fingerprint lock, your data is completely readable by anyone who finds it. Set a 6+ digit PIN today.</p><p>SELA offers privacy and security audits for businesses. Contact us to ensure your systems protect customer data appropriately.</p>`
  },
  {
    id: 'p16',
    title: 'Malware Removal Guide: How to Clean an Infected Windows PC Step by Step',
    category: 'How-To',
    tag: 'How-To',
    emoji: '🦠',
    color: '#00d4ff',
    featured: false,
    readTime: '5 min read',
    date: new Date(Date.now() - 9*24*60*60*1000),
    views: 3760,
    likes: 268,
    excerpt: 'Slow PC, strange ads, browser homepage changed by itself — you likely have malware. This step-by-step removal guide works on 95% of common infections without formatting your drive.',
    tags: ['malware','cybersecurity','step-by-step','performance','tricks'],
    body: `<p><strong>Malware on Windows PCs is widespread in Kenya,</strong> often spread through pirated software, infected flash disks, and malicious downloads. This guide removes 95% of common infections without formatting.</p><h3>Signs You Are Infected</h3><ul><li>PC is dramatically slower, especially at startup</li><li>Browser homepage changed without your permission</li><li>Pop-up ads appear even without a browser open</li><li>Antivirus was disabled and won't re-enable</li><li>Unknown programs in Task Manager consuming high CPU or RAM</li></ul><h3>Step 1 — Boot into Safe Mode</h3><p>Press Windows Key + R, type msconfig, go to Boot tab, check Safe Boot. Restart. In Safe Mode, most malware cannot run because it blocks third-party programs from loading.</p><h3>Step 2 — Run Malwarebytes Free</h3><p>Download <strong>Malwarebytes Free</strong> from the official malwarebytes.com only. Run a full scan. Malwarebytes specifically targets malware that standard antivirus misses — adware, spyware, browser hijackers, and PUPs.</p><h3>Step 3 — Run Windows Defender Full Scan</h3><p>Open Windows Security → Virus and threat protection → Scan options → Full scan. This catches traditional viruses and trojans Malwarebytes may have missed.</p><div class="tip-box"><strong>⚠️ Important:</strong> Never install multiple antivirus programs simultaneously. They conflict with each other and worsen performance. Windows Defender plus Malwarebytes is the professional standard.</div><h3>Step 4 — Remove Suspicious Browser Extensions</h3><p>Open Chrome → Settings → Extensions. Remove anything you did not personally install. Malware frequently installs extensions that redirect searches and inject ads. Check every extension carefully.</p><h3>Step 5 — Reset Browser Settings</h3><p>In Chrome: Settings → Reset settings → Restore to original defaults. This removes hijacked homepage settings, injected search engines, and malicious startup pages.</p><h3>When to Format Instead</h3><p>If the infection is a rootkit or ransomware, cleaning is often insufficient. A clean Windows installation is the only guaranteed solution. SELA provides <strong>virus removal and Windows reinstallation from KES 400</strong> at all branches.</p>`
  }

];
