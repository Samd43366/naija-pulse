import re, sys, io
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
p = r"C:\Users\samad\.gemini\antigravity\scratch\naija-pulse\frontend\src\components\map\NigeriaVectorBasemap.jsx"
s = open(p, encoding="utf-8").read()

def rep(old, new, count=None):
    global s
    n = s.count(old)
    if n == 0:
        print("MISSING:", old[:80]); return
    s = s.replace(old, new)
    print(f"ok x{n}: {old[:60]!r}")

# 1. palette block replaces ZONE_FILL
old_zone = s[s.index("const ZONE_FILL = {"): s.index("const PLACE_ICONS")]
palettes = """// Theme palettes: the atlas is drawn in a dark "night atlas" style for the dark theme and
// a clean cream / sky-blue "daylight atlas" style for the light theme.
const PALETTES = {
  dark: {
    zoneFill: {
      'North-West': '#152536',
      'North-East': '#182434',
      'North-Central': '#142836',
      'South-West': '#132a34',
      'South-East': '#172738',
      'South-South': '#112b33',
    },
    zoneDefault: '#152636',
    graticule: '#1e3a5f',
    graticuleOpacity: 0.32,
    bight: '#38bdf866',
    neighborFill: '#0b1522',
    neighborLine: '#22334a',
    neighborLabel: '#475569',
    stateLine: '#5b85aa',
    stateLineOff: '#263c52',
    urbanFill: '#223549',
    urbanLine: '#334e68',
    parkFill: '#115e59',
    parkLine: '#14b8a6',
    lgaLine: '#466a8a',
    gridLine: '#475f78',
    trunkMajor: '#94a3b8',
    trunkMinor: '#64748b',
    casing: '#09111e',
    rail: '#38bdf8',
    bridge: '#fde047',
    expressway: '#f59e0b',
    street: '#e2e8f0',
    lakeFill: '#0369a1',
    lakeLine: '#38bdf8',
    urbanWaterFill: '#07192e',
    urbanWaterLine: '#0ea5e9',
    riverMajor: '#38bdf8',
    riverMinor: '#0ea5e9',
    frontier: '#10b981',
    stateLabel: '#cbd5e1',
    lgaLabel: '#7dd3fc',
    areaMajor: '#f1f5f9',
    area: '#cbd5e1',
    halo: '0 1px 3px #020617,0 0 6px #020617',
    haloStrong: '0 1px 4px #000,0 0 5px #000',
    streetBadgeBg: '#020617cc',
    streetBadgeBorder: '#33415599',
    streetBridge: '#fde047',
    streetExpy: '#fcd34d',
    streetPlain: '#94a3b8',
    place: '#a7f3d0',
    peak: '#fdba74',
    confluence: '#7dd3fc',
    capital: '#fde047',
    city: '#f8fafc',
  },
  light: {
    zoneFill: {
      'North-West': '#f3efe3',
      'North-East': '#f1ecdd',
      'North-Central': '#eef0df',
      'South-West': '#e9f0df',
      'South-East': '#f0eedf',
      'South-South': '#e5efe0',
    },
    zoneDefault: '#f0eee2',
    graticule: '#8fb0c8',
    graticuleOpacity: 0.5,
    bight: '#2b7fb0aa',
    neighborFill: '#e9e6dc',
    neighborLine: '#c4bfae',
    neighborLabel: '#8a8f87',
    stateLine: '#8ea597',
    stateLineOff: '#cbd3c9',
    urbanFill: '#e3dccb',
    urbanLine: '#cdc4ae',
    parkFill: '#b6dfbd',
    parkLine: '#4fa66f',
    lgaLine: '#7b95a8',
    gridLine: '#b9b3a3',
    trunkMajor: '#8a8d84',
    trunkMinor: '#acaea4',
    casing: '#b8b2a0',
    rail: '#0b6fb8',
    bridge: '#e3a800',
    expressway: '#ec8a10',
    street: '#ffffff',
    lakeFill: '#7cc3ea',
    lakeLine: '#2b8cc4',
    urbanWaterFill: '#a6d4ee',
    urbanWaterLine: '#3c9ad1',
    riverMajor: '#2b8cc4',
    riverMinor: '#4ea9dc',
    frontier: '#008751',
    stateLabel: '#2c4638',
    lgaLabel: '#2b6a93',
    areaMajor: '#10231a',
    area: '#3a4f43',
    halo: '0 0 3px #fff,0 0 5px #fff,0 0 8px #fff',
    haloStrong: '0 0 3px #fff,0 0 5px #fff,0 0 8px #fff',
    streetBadgeBg: '#ffffffd9',
    streetBadgeBorder: '#c8cfc5',
    streetBridge: '#8a5a00',
    streetExpy: '#9a5400',
    streetPlain: '#55665c',
    place: '#0b6b43',
    peak: '#a8480a',
    confluence: '#1f78ad',
    capital: '#9a5b00',
    city: '#10231a',
  },
}

"""
s = s.replace(old_zone, palettes)

rep("export default function NigeriaVectorBasemap({ layers = DEFAULT_LAYERS, pickMode = false }) {\n  const map = useMap()",
    "export default function NigeriaVectorBasemap({\n  layers = DEFAULT_LAYERS,\n  pickMode = false,\n  theme = 'dark',\n}) {\n  const map = useMap()\n  const P = PALETTES[theme] || PALETTES.dark")

rep("color: '#1e3a5f', weight: 0.6, opacity: 0.32,", "color: P.graticule, weight: 0.6, opacity: P.graticuleOpacity,")
rep("color:#38bdf866;font-size:10px;font-style:italic;letter-spacing:0.18em;text-align:center;", "color:${P.bight};font-size:10px;font-style:italic;letter-spacing:0.18em;text-align:center;")
rep("fillColor: '#0b1522',", "fillColor: P.neighborFill,")
rep("color: '#22334a',", "color: P.neighborLine,")
rep("color:#475569;font-size:9px;font-weight:600;letter-spacing:0.16em;", "color:${P.neighborLabel};font-size:9px;font-weight:600;letter-spacing:0.16em;")
rep("fillColor: ZONE_FILL[feature.properties.zone] || '#152636',", "fillColor: P.zoneFill[feature.properties.zone] || P.zoneDefault,")
rep("color: layers.states ? '#5b85aa' : '#263c52',", "color: layers.states ? P.stateLine : P.stateLineOff,")
rep("fillColor: '#223549',", "fillColor: P.urbanFill,")
rep("color: '#334e68',", "color: P.urbanLine,")
rep("fillColor: '#115e59',", "fillColor: P.parkFill,")
rep("              color: '#14b8a6',\n              weight: 0.9,", "              color: P.parkLine,\n              weight: 0.9,")
rep("color: '#466a8a',", "color: P.lgaLine,")
rep("color: '#475f78',", "color: P.gridLine,")
rep("color: feature.properties.major ? '#94a3b8' : '#64748b',", "color: feature.properties.major ? P.trunkMajor : P.trunkMinor,")
rep("color: '#09111e',", "color: P.casing,")
rep("color: '#38bdf8',\n                      weight: zoom >= 12 ? 1.8 : 1.2,", "color: P.rail,\n                      weight: zoom >= 12 ? 1.8 : 1.2,")
rep("color: '#fde047',\n                      weight: zoom >= 13 ? 3.4 : 2.3,", "color: P.bridge,\n                      weight: zoom >= 13 ? 3.4 : 2.3,")
rep("color: '#f59e0b',\n                      weight: zoom >= 13 ? 2.8 : 1.9,", "color: P.expressway,\n                      weight: zoom >= 13 ? 2.8 : 1.9,")
rep("color: '#e2e8f0',\n                    weight: zoom >= 13 ? 2.0 : 1.3,", "color: P.street,\n                    weight: zoom >= 13 ? 2.0 : 1.3,")
rep("fillColor: '#0369a1',", "fillColor: P.lakeFill,")
rep("              color: '#38bdf8',\n              weight: 1,", "              color: P.lakeLine,\n              weight: 1,")
rep("fillColor: '#07192e',", "fillColor: P.urbanWaterFill,")
rep("color: '#0ea5e9',\n                weight: 1.15,", "color: P.urbanWaterLine,\n                weight: 1.15,")
rep("color: major ? '#38bdf8' : '#0ea5e9',", "color: major ? P.riverMajor : P.riverMinor,")
rep("color: '#fde047',\n              weight: zoom >= 13 ? 3.5 : 2.4,", "color: P.bridge,\n              weight: zoom >= 13 ? 3.5 : 2.4,")
rep("color: '#10b981',\n            weight: 2.2,", "color: P.frontier,\n            weight: 2.2,")

# Labels
rep("color:#cbd5e1;font-size:${fontSize}px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;text-shadow:0 1px 3px #020617,0 0 6px #020617;",
    "color:${P.stateLabel};font-size:${fontSize}px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;text-shadow:${P.halo};")
rep("color:#7dd3fc;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;text-shadow:0 1px 3px #020617,0 0 5px #020617;",
    "color:${P.lgaLabel};font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;text-shadow:${P.halo};")
rep("color:${isMajor ? '#f1f5f9' : '#cbd5e1'};", "color:${isMajor ? P.areaMajor : P.area};")
rep("text-shadow:0 1px 3px #020617,0 0 6px #020617;text-align:center;white-space:nowrap;\">${a.name}", "text-shadow:${P.halo};text-align:center;white-space:nowrap;\">${a.name}")
rep("kind === 'bridge' ? '#fde047' : kind === 'expressway' ? '#fcd34d' : '#94a3b8'",
    "kind === 'bridge' ? P.streetBridge : kind === 'expressway' ? P.streetExpy : P.streetPlain")
rep("background:#020617cc;border:1px solid #33415599;", "background:${P.streetBadgeBg};border:1px solid ${P.streetBadgeBorder};")
rep("color:#a7f3d0;font-size:9px;font-weight:600;text-shadow:0 1px 3px #020617,0 0 6px #020617;", "color:${P.place};font-size:9px;font-weight:600;text-shadow:${P.halo};")
rep("color:#fdba74;font-size:9px;font-weight:700;text-shadow:0 1px 3px #000,0 0 5px #000;", "color:${P.peak};font-size:9px;font-weight:700;text-shadow:${P.haloStrong};")
rep("color:#7dd3fc;font-size:9px;font-style:italic;text-shadow:0 1px 3px #000,0 0 5px #000;", "color:${P.confluence};font-size:9px;font-style:italic;text-shadow:${P.haloStrong};")
rep("color:#fde047;font-size:10px;font-weight:800;text-shadow:0 1px 4px #000;", "color:${P.capital};font-size:10px;font-weight:800;text-shadow:${P.haloStrong};")
rep("color:#f8fafc;font-size:10px;font-weight:700;text-shadow:0 1px 4px #000;", "color:${P.city};font-size:10px;font-weight:700;text-shadow:${P.haloStrong};")

open(p, "w", encoding="utf-8").write(s)
print("done")
