import type {
  FeatureCard,
  FirmwareCard,
  RemoteServiceEntry,
  SimpleCard,
  SitePage,
  SitePageKey,
  TickerItem,
} from './data-types'

export const latestUploads: TickerItem[] = [
  { title: 'Huawei Nova 11i Board Software Package', meta: 'Huawei', icon: 'fa-file-archive' },
  { title: 'Honor X9b Full OTA HarmonyOS Package', meta: 'Honor', icon: 'fa-file-archive' },
  { title: 'Kirin Secure Boot Repair Files', meta: 'Kirin', icon: 'fa-file-archive' },
  { title: 'Huawei Qualcomm EDL Rescue Package', meta: 'Qualcomm', icon: 'fa-file-archive' },
]

export const topFiles: TickerItem[] = [
  { title: 'Honor 90 Smart Testpoint Guide', meta: '8,452 downloads', icon: 'fa-fire' },
  { title: 'Huawei ID Remove Workflow', meta: '7,210 downloads', icon: 'fa-fire' },
  { title: 'Kirin USB COM Driver Pack', meta: '9,123 downloads', icon: 'fa-fire' },
]

export const stats = [
  { value: 'Organized', label: 'Huawei, Honor, and custom folders', icon: 'fa-signal', tone: 'primary' },
  { value: 'Brand-First', label: 'Structured browsing by brand and solution', icon: 'fa-folder-tree', tone: 'success' },
  { value: 'Direct', label: 'Fast file access and support flow', icon: 'fa-hard-drive', tone: 'info' },
  { value: 'Trusted', label: 'Clean delivery for service-side work', icon: 'fa-shield-halved', tone: 'warning' },
]

export const remoteServiceQualcommEntries: RemoteServiceEntry[] = [
  { model: 'AGS5Z-XXX / AGS5-XXX', platform: 'QC_680_EMMC' },
  { model: 'AGS5Z-XXX / AGS5-XXX', platform: 'QC_680_UFS' },
  { model: 'ANY / RMO', platform: 'QC_695' },
  { model: 'ANY / RMO', platform: 'QC_695_2' },
  { model: 'ABR-XXX', platform: 'QC_778' },
  { model: 'ANN-AN00', platform: 'QC_782' },
  { model: 'ALT-LXX', platform: 'QC_8+4G' },
  { model: 'AVA-PA00', platform: 'QC_888' },
  { model: 'BNE-AL00 / LXX', platform: 'QC_680' },
  { model: 'BAL-XXX', platform: 'QC_888' },
  { model: 'BAH4-AL10', platform: 'QC_778' },
  { model: 'BTK-XXX / BTKZ-XXX', platform: 'QC_7_Gen_1' },
  { model: 'ANY-LX1', platform: 'QC_695' },
  { model: 'CET-XXX', platform: 'QC_8+4G' },
  { model: 'DCO-XXX', platform: 'QC_8+4G' },
  { model: 'CTR-AL00', platform: 'QC_680' },
  { model: 'CMA-LX1 / TFY-LX1', platform: 'QC_680' },
  { model: 'DBR-XXX', platform: 'QC_865' },
  { model: 'DBY-XXX', platform: 'QC_870' },
  { model: 'DBY2-XXX', platform: 'QC_888' },
  { model: 'ELN-XXX', platform: 'QC_685' },
  { model: 'ELZ-AN00', platform: 'QC_888' },
  { model: 'ELZ-AN10 / AN20', platform: 'QC_888' },
  { model: 'FNE-XXX', platform: 'QC_778' },
  { model: 'FOA-XXX', platform: 'QC_778' },
  { model: 'FIN-AL60', platform: 'QC_778' },
  { model: 'GDI-W09', platform: 'QC_888' },
  { model: 'GOA-XXX', platform: 'QC_778' },
  { model: 'GOT-W09 / AL09 / AL19', platform: 'QC_888' },
  { model: 'GOT-W29', platform: 'QC_870' },
  { model: 'HEY-W09', platform: 'QC_680' },
  { model: 'JLN-XXX', platform: 'QC_680' },
  { model: 'JAD-XXX', platform: 'QC_888' },
  { model: 'LNA-AL00', platform: 'QC_8+4G' },
  { model: 'LSA-XXX', platform: 'QC_778' },
  { model: 'MNA-AL00', platform: 'QC_8+4G' },
  { model: 'MAO-AL00', platform: 'QC_680' },
  { model: 'MRR-XXX', platform: 'QC_870' },
  { model: 'NTH-XXX', platform: 'QC_778' },
  { model: 'NAM-XXX', platform: 'QC_778' },
  { model: 'NCO-XXX', platform: 'QC_778' },
  { model: 'NTN-LXX', platform: 'QC_662' },
  { model: 'NEL-AN00 / GON-AN00', platform: 'QC_778' },
  { model: 'PCU-AN00 / PKP-AN60', platform: 'QC_480' },
  { model: 'PAL-AL00 / LXX', platform: 'QC_888' },
  { model: 'RNA-AL00', platform: 'QC_778' },
  { model: 'RNA / TNA-AN00', platform: 'QC_778' },
  { model: 'TINA / KATHY-AN00', platform: 'QC_778' },
  { model: 'WDY-AN00', platform: 'QC_480PLUS' },
  { model: 'VNE-XXX', platform: 'QC_480PLUS' },
]

export const pageLinks: SimpleCard[] = [
  { title: 'Huawei', subtitle: 'Board software, XML packages, and recovery files', badge: 'Open Page', icon: 'fa-mobile-screen', accent: 'violet' },
  { title: 'Honor', subtitle: 'FRP flows, OTA files, and service packages', badge: 'Open Page', icon: 'fa-shield-halved', accent: 'green' },
  { title: 'Kirin Tools', subtitle: 'USB loaders, board access, and secure boot work', badge: 'Open Page', icon: 'fa-microchip', accent: 'pink' },
  { title: 'HarmonyOS Files', subtitle: 'Full OTA, rollback, and system recovery packages', badge: 'Open Page', icon: 'fa-layer-group', accent: 'amber' },
]

const homeFocusCards: SimpleCard[] = [
  { title: 'Huawei ID Remove', subtitle: 'Remote Service', badge: 'Available', icon: 'fa-user-shield', accent: 'violet' },
  { title: 'Honor FRP Unlock', subtitle: 'Fast Delivery', badge: 'Available', icon: 'fa-lock-open', accent: 'green' },
  { title: 'Kirin Loader Suite', subtitle: 'Tool Access', badge: 'Ready', icon: 'fa-microchip', accent: 'pink' },
  { title: 'HarmonyOS Recovery', subtitle: 'Premium Access', badge: 'Available', icon: 'fa-rotate', accent: 'amber' },
]

const huaweiFocusCards: SimpleCard[] = [
  { title: 'Board Software', subtitle: 'Factory Service Files', badge: 'Core', icon: 'fa-screwdriver-wrench', accent: 'violet' },
  { title: 'XML Packages', subtitle: 'Flash-Ready Layouts', badge: 'Verified', icon: 'fa-code-branch', accent: 'green' },
  { title: 'Testpoint Help', subtitle: 'Repair Workflow', badge: 'Guide', icon: 'fa-wrench', accent: 'pink' },
  { title: 'Huawei ID Remove', subtitle: 'Remote Service', badge: 'Available', icon: 'fa-user-shield', accent: 'amber' },
]

const honorFocusCards: SimpleCard[] = [
  { title: 'Honor FRP Unlock', subtitle: 'Fast Delivery', badge: 'Active', icon: 'fa-lock-open', accent: 'violet' },
  { title: 'Honor OTA Files', subtitle: 'System Recovery', badge: 'Updated', icon: 'fa-cloud-arrow-down', accent: 'green' },
  { title: 'Honor Testpoint', subtitle: 'Repair Access', badge: 'Guide', icon: 'fa-screwdriver', accent: 'pink' },
  { title: 'Honor Qualcomm Support', subtitle: 'EDL Rescue', badge: 'Ready', icon: 'fa-bolt', accent: 'amber' },
]

const kirinFocusCards: SimpleCard[] = [
  { title: 'USB COM Drivers', subtitle: 'Loader Connection', badge: 'Required', icon: 'fa-plug', accent: 'violet' },
  { title: 'Secure Boot Files', subtitle: 'Board Recovery', badge: 'Core', icon: 'fa-shield-halved', accent: 'green' },
  { title: 'Kirin Loader Suite', subtitle: 'Flash Support', badge: 'Ready', icon: 'fa-microchip', accent: 'pink' },
  { title: 'Board Repair Flow', subtitle: 'Service Notes', badge: 'Guide', icon: 'fa-route', accent: 'amber' },
]

const harmonyFocusCards: SimpleCard[] = [
  { title: 'Full OTA Packs', subtitle: 'System Updates', badge: 'Official', icon: 'fa-cloud-arrow-down', accent: 'violet' },
  { title: 'Rollback Files', subtitle: 'Version Restore', badge: 'Safe', icon: 'fa-rotate-left', accent: 'green' },
  { title: 'Recovery Packages', subtitle: 'Repair Ready', badge: 'Verified', icon: 'fa-life-ring', accent: 'pink' },
  { title: 'HarmonyOS Notes', subtitle: 'Service Flow', badge: 'Guide', icon: 'fa-book-open', accent: 'amber' },
]

const homePackages: FirmwareCard[] = [
  {
    id: 'huawei-nova-11i-board-software',
    title: 'Huawei Nova 11i Full Board Software and XML Package',
    brand: 'Huawei',
    downloads: '9,421',
    age: '2 days ago',
    status: ['Official', 'Tested'],
    description: 'Board software bundle with XML layout, restore resources, and service-ready files for Huawei Nova repair work.',
    size: '3.24 GB',
    date: '2026-04-02 11:36:00',
    visits: '2,619',
  },
  {
    id: 'honor-x9b-harmonyos-recovery',
    title: 'Honor X9b HarmonyOS Recovery and OTA Package',
    brand: 'Honor',
    downloads: '8,103',
    age: '5 days ago',
    status: ['Official', 'Tested'],
    description: 'Full OTA archive for Honor X9b with update and recovery support for system restore work.',
    size: '5.88 GB',
    date: '2026-04-02 14:15:00',
    visits: '2,321',
  },
  {
    id: 'qualcomm-edl-rescue',
    title: 'Huawei Qualcomm EDL Rescue Loader and USB Package',
    brand: 'Qualcomm',
    downloads: '6,742',
    age: '1 week ago',
    status: ['Tested', 'Fixed'],
    description: 'EDL rescue package for supported Huawei and Honor Qualcomm models with useful board access support files.',
    size: '1.08 GB',
    date: '2026-03-30 22:48:00',
    visits: '1,940',
  },
]

const huaweiPackages: FirmwareCard[] = [
  homePackages[0],
  {
    id: 'huawei-mate-50-service-xml',
    title: 'Huawei Mate 50 Service XML and Recovery Set',
    brand: 'Huawei Mate',
    downloads: '7,114',
    age: '1 week ago',
    status: ['Recovery', 'Tested'],
    description: 'Recovery XML, loader notes, and restore files tailored for Huawei Mate service cases.',
    size: '2.14 GB',
    date: '2026-04-01 18:20:00',
    visits: '1,791',
  },
  {
    id: 'huawei-p60-factory-restore',
    title: 'Huawei P60 Pro Factory Restore and Rescue Set',
    brand: 'Huawei P',
    downloads: '6,233',
    age: '9 days ago',
    status: ['Factory', 'Verified'],
    description: 'Factory restore resources selected for Huawei P60 repair and rescue operations.',
    size: '2.91 GB',
    date: '2026-03-28 09:40:00',
    visits: '1,506',
  },
]

const honorPackages: FirmwareCard[] = [
  homePackages[1],
  {
    id: 'honor-90-smart-testpoint',
    title: 'Honor 90 Smart Service Firmware and Testpoint Guide',
    brand: 'Honor Number',
    downloads: '7,008',
    age: '6 days ago',
    status: ['Official', 'Service'],
    description: 'Support package with testpoint references, rescue notes, and board access reminders for Honor 90 Smart jobs.',
    size: '428 MB',
    date: '2026-03-31 20:05:00',
    visits: '1,587',
  },
  {
    id: 'honor-magic-rollback',
    title: 'Honor Magic Series Rollback and Recovery Set',
    brand: 'Honor Magic',
    downloads: '5,882',
    age: '8 days ago',
    status: ['Rollback', 'Verified'],
    description: 'Rollback and recovery package for Honor Magic models with service-side recovery resources.',
    size: '4.12 GB',
    date: '2026-03-29 08:22:00',
    visits: '1,420',
  },
]

const kirinPackages: FirmwareCard[] = [
  {
    id: 'kirin-secure-boot-repair',
    title: 'Kirin Secure Boot Repair Loader and USB Driver Set',
    brand: 'Kirin',
    downloads: '9,003',
    age: '1 day ago',
    status: ['Loader', 'Core'],
    description: 'Secure boot support package with key repair-side files for Kirin-based Huawei and Honor boards.',
    size: '1.92 GB',
    date: '2026-04-03 07:42:00',
    visits: '2,898',
  },
  {
    id: 'kirin-testpoint-access',
    title: 'Kirin Testpoint Access Notes and Board Rescue Files',
    brand: 'Kirin',
    downloads: '7,905',
    age: '4 days ago',
    status: ['Guide', 'Verified'],
    description: 'Testpoint handling notes and board rescue files for Kirin service workflows.',
    size: '744 MB',
    date: '2026-03-31 10:14:00',
    visits: '2,110',
  },
  {
    id: 'kirin-loader-suite',
    title: 'Kirin Flash Support Package for Huawei and Honor Boards',
    brand: 'Kirin',
    downloads: '6,840',
    age: '1 week ago',
    status: ['Support', 'Tested'],
    description: 'USB connection pack with loader-side support files and COM drivers used in Kirin service workflows.',
    size: '612 MB',
    date: '2026-04-01 09:12:00',
    visits: '2,012',
  },
]

const harmonyPackages: FirmwareCard[] = [
  {
    id: 'harmonyos-recovery-bundle',
    title: 'Honor X9b HarmonyOS Full OTA and Recovery Package',
    brand: 'HarmonyOS',
    downloads: '8,611',
    age: '2 days ago',
    status: ['Full OTA', 'Official'],
    description: 'HarmonyOS restore bundle for rollback, system recovery, and package-based software repair tasks.',
    size: '4.73 GB',
    date: '2026-04-02 06:50:00',
    visits: '2,250',
  },
  {
    id: 'harmonyos-rollback-restore',
    title: 'Huawei Mate HarmonyOS Rollback and Restore Bundle',
    brand: 'HarmonyOS',
    downloads: '7,233',
    age: '5 days ago',
    status: ['Rollback', 'Tested'],
    description: 'Rollback and restore bundle for Huawei Mate HarmonyOS cases with safe recovery resources.',
    size: '3.86 GB',
    date: '2026-03-30 17:30:00',
    visits: '1,874',
  },
  homePackages[2],
]

const homeFeatures: FeatureCard[] = [
  {
    title: 'Huawei & Honor Firmware',
    description: 'Firmware library for Huawei and Honor models, including board software and recovery packages.',
    icon: 'fa-file-download',
    tone: 'primary',
  },
  {
    title: 'Kirin Repair Flow',
    description: 'Useful files and workflows for Kirin devices, testpoint cases, and secure boot recovery jobs.',
    icon: 'fa-unlock-alt',
    tone: 'warning',
  },
  {
    title: 'HarmonyOS Access',
    description: 'Recovery, update, and service packages for HarmonyOS devices with clean download options.',
    icon: 'fa-key',
    tone: 'success',
  },
  {
    title: 'Qualcomm Support',
    description: 'EDL resources for supported Huawei and Honor models built on Qualcomm platforms.',
    icon: 'fa-headset',
    tone: 'info',
  },
]

const huaweiFeatures: FeatureCard[] = [
  {
    title: 'Factory Restore Sets',
    description: 'Files selected for Huawei board-level recovery, restore paths, and tested flash sequences.',
    icon: 'fa-box-open',
    tone: 'primary',
  },
  {
    title: 'Service XML Ready',
    description: 'Quick access to XML-based flash layouts and rescue resources used in Huawei service work.',
    icon: 'fa-diagram-project',
    tone: 'warning',
  },
  {
    title: 'Repair Workflow Notes',
    description: 'Useful reminders for loader preparation, board access, and safe restore steps.',
    icon: 'fa-notes-medical',
    tone: 'success',
  },
  {
    title: 'Remote Help',
    description: 'Support files and service delivery for Huawei repair cases.',
    icon: 'fa-headset',
    tone: 'info',
  },
]

const honorFeatures: FeatureCard[] = [
  {
    title: 'Honor Recovery Files',
    description: 'Packages aligned with Honor system restore cases, OTA reloads, and software repair flows.',
    icon: 'fa-life-ring',
    tone: 'primary',
  },
  {
    title: 'FRP and ID Jobs',
    description: 'Entries for lock removal, account-related jobs, and supported Honor workflows.',
    icon: 'fa-user-lock',
    tone: 'warning',
  },
  {
    title: 'Qualcomm Rescue',
    description: 'Useful Qualcomm rescue materials for supported Honor lines that require board-level access.',
    icon: 'fa-plug',
    tone: 'success',
  },
  {
    title: 'Repair-Centered Catalog',
    description: 'Honor-only catalog flow so the page stays clean and targeted instead of mixing unrelated brands.',
    icon: 'fa-layer-group',
    tone: 'info',
  },
]

const kirinFeatures: FeatureCard[] = [
  {
    title: 'Loader-Oriented Setup',
    description: 'Built around Kirin access needs, from USB preparation to supported loader-based recovery steps.',
    icon: 'fa-microchip',
    tone: 'primary',
  },
  {
    title: 'Board Access Notes',
    description: 'Service notes for testpoint handling, secure boot cases, and Kirin-specific board repair patterns.',
    icon: 'fa-sitemap',
    tone: 'warning',
  },
  {
    title: 'Huawei and Honor Coverage',
    description: 'Kirin resources tied back to the Huawei and Honor models most often seen in repair workflows.',
    icon: 'fa-mobile-screen-button',
    tone: 'success',
  },
  {
    title: 'Practical Tool Access',
    description: 'A compact tools page for Kirin work without distractions from other unrelated device ecosystems.',
    icon: 'fa-toolbox',
    tone: 'info',
  },
]

const harmonyFeatures: FeatureCard[] = [
  {
    title: 'Clean OTA Access',
    description: 'HarmonyOS package sets with OTA, restore, and system update entry points.',
    icon: 'fa-arrows-rotate',
    tone: 'primary',
  },
  {
    title: 'Rollback Safety',
    description: 'Support for rollback-style cases where version recovery and system stability matter most.',
    icon: 'fa-clock-rotate-left',
    tone: 'warning',
  },
  {
    title: 'Huawei and Honor Scope',
    description: 'No off-topic firmware families, just HarmonyOS coverage for Huawei and Honor repair work.',
    icon: 'fa-bullseye',
    tone: 'success',
  },
  {
    title: 'Service-Centered Layout',
    description: 'A direct page for HarmonyOS resources so the content stays simple and easy to browse.',
    icon: 'fa-folder-open',
    tone: 'info',
  },
]

export const pages: Record<SitePageKey, SitePage> = {
  home: {
    key: 'home',
    title: 'AOSUNLOCKER Huawei Lab',
    eyebrow: '',
    heroTitle: 'Huawei & Honor Files',
    heroCopy: '',
    quickLabel: 'Huawei Focus',
    primaryEyebrow: 'Core Services',
    primaryTitle: 'Huawei & Honor Service Access',
    primaryItems: homeFocusCards,
    packageEyebrow: 'Latest Packages',
    packageTitle: 'Featured Huawei and Honor Packages',
    packageItems: homePackages,
    featureEyebrow: 'Core Scope',
    featureTitle: 'Built for Huawei, Honor, Kirin, and HarmonyOS',
    featureItems: homeFeatures,
    ctaEyebrow: 'Huawei Focus',
    ctaTitle: 'Everything here is now tuned around Huawei, Honor, Kirin, HarmonyOS, and Qualcomm repair work.',
    ctaCopy: 'Use the pages above to jump into the exact area you want to open next.',
  },
  huawei: {
    key: 'huawei',
    title: 'Huawei Files | AOSUNLOCKER Huawei Lab',
    eyebrow: 'Huawei Section',
    heroTitle: 'Huawei Board Software, XML Packages, and Restore Resources',
    heroCopy: 'A Huawei-only page for board software, service XML layouts, recovery material, and remote support flows tied to Huawei repair work.',
    quickLabel: 'Huawei Files',
    primaryEyebrow: 'Huawei Workflow',
    primaryTitle: 'Huawei Repair and Access Services',
    primaryItems: huaweiFocusCards,
    packageEyebrow: 'Huawei Packages',
    packageTitle: 'Huawei Board and Recovery Packages',
    packageItems: huaweiPackages,
    featureEyebrow: 'Huawei Support',
    featureTitle: 'Why This Huawei Section Works Better',
    featureItems: huaweiFeatures,
    ctaEyebrow: 'Huawei Work',
    ctaTitle: 'Board software, XML support, and restore flows stay together here for faster Huawei browsing.',
    ctaCopy: 'This section is tuned for Huawei-only cases so the catalog stays sharp instead of mixing unrelated content.',
  },
  honor: {
    key: 'honor',
    title: 'Honor Files | AOSUNLOCKER Huawei Lab',
    eyebrow: 'Honor Section',
    heroTitle: 'Honor Firmware, FRP Jobs, OTA Bundles, and Service Packages',
    heroCopy: 'A clean page for Honor service work, including OTA recovery packages, service firmware, FRP-related jobs, and repair package browsing.',
    quickLabel: 'Honor Files',
    primaryEyebrow: 'Honor Workflow',
    primaryTitle: 'Honor Service and Unlock Access',
    primaryItems: honorFocusCards,
    packageEyebrow: 'Honor Packages',
    packageTitle: 'Honor OTA and Service Firmware',
    packageItems: honorPackages,
    featureEyebrow: 'Honor Support',
    featureTitle: 'Built for Clean Honor Repair Browsing',
    featureItems: honorFeatures,
    ctaEyebrow: 'Honor Work',
    ctaTitle: 'Honor jobs, OTA packages, and repair support now have a dedicated page.',
    ctaCopy: 'This keeps the Honor side cleaner and easier to grow without mixing Huawei board material into the same view.',
  },
  kirin: {
    key: 'kirin',
    title: 'Kirin Tools | AOSUNLOCKER Huawei Lab',
    eyebrow: 'Kirin Tools',
    heroTitle: 'Kirin USB Loaders, Secure Boot Files, and Board Access Resources',
    heroCopy: 'A dedicated page for Kirin-related tools, loader support, secure boot handling, USB preparation, and practical repair-side access resources.',
    quickLabel: 'Kirin Resources',
    primaryEyebrow: 'Kirin Workflow',
    primaryTitle: 'Kirin Tooling and Access Layers',
    primaryItems: kirinFocusCards,
    packageEyebrow: 'Kirin Resources',
    packageTitle: 'Kirin Loader and Repair Packages',
    packageItems: kirinPackages,
    featureEyebrow: 'Kirin Focus',
    featureTitle: 'Built for Kirin Board-Level Work',
    featureItems: kirinFeatures,
    ctaEyebrow: 'Kirin Work',
    ctaTitle: 'Loader access, secure boot support, and board notes stay grouped here for Kirin jobs.',
    ctaCopy: 'This page is meant to feel like a technician shelf for Kirin work rather than a generic mobile tools dump.',
  },
  harmony: {
    key: 'harmony',
    title: 'HarmonyOS Files | AOSUNLOCKER Huawei Lab',
    eyebrow: 'HarmonyOS Section',
    heroTitle: 'HarmonyOS Full OTA, Rollback Packages, and Recovery Files',
    heroCopy: 'A direct page for HarmonyOS resources covering OTA bundles, rollback support, restore packages, and Huawei/Honor system recovery workflows.',
    quickLabel: 'HarmonyOS Files',
    primaryEyebrow: 'HarmonyOS Workflow',
    primaryTitle: 'HarmonyOS Access and Recovery Paths',
    primaryItems: harmonyFocusCards,
    packageEyebrow: 'HarmonyOS Packages',
    packageTitle: 'HarmonyOS OTA and Recovery Sets',
    packageItems: harmonyPackages,
    featureEyebrow: 'HarmonyOS Focus',
    featureTitle: 'Built for Clean HarmonyOS Browsing',
    featureItems: harmonyFeatures,
    ctaEyebrow: 'HarmonyOS Work',
    ctaTitle: 'Full OTA, rollback, and service recovery files are grouped here for Huawei and Honor HarmonyOS cases.',
    ctaCopy: 'Use this page when you want the cleanest view for HarmonyOS-specific work without switching through mixed content.',
  },
}

export const fileMap = Object.fromEntries(
  [...homePackages, ...huaweiPackages, ...honorPackages, ...kirinPackages, ...harmonyPackages].map((item) => [item.id, item]),
) as Record<string, FirmwareCard>
