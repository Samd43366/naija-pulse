"""
PulseAI — Trained Hybrid NLP (Sublinear TF-IDF + Bigram Cosine Similarity) & Live Spatial RAG Engine.

Pedagogical Overview:
1. Vector Space Retrieval (Trained Local Brain — Zero API Key Required):
   At startup, PulseAI indexes a curated multi-domain corpus (Nigeria's 36 States + FCT,
   emergency hotlines, safety SOPs, DisCos/power grid, NEMA/NIHSA hydrology, health, general
   knowledge, and Naija Pulse's mathematical architecture) into L2-normalized TF-IDF unigram+bigram
   vectors:
       w(t, d) = (1 + ln(tf(t, d))) * (ln((N + 1) / (df(t) + 1)) + 1)
   Incoming questions are projected into the same vector space and scored via Cosine Similarity.

2. Live Spatial & Statistical Grounding (836+ Nationwide Incidents):
   PulseAI inspects live incidents across all 36 States + FCT and 774 LGAs to answer real-time
   civic intelligence queries ("What is happening in Borno?", "Which state has the most floods?",
   "Is Abuja–Kaduna road safe?") and returns actionable `map_action` coordinates.

3. Optional LLM Generation Upgrade:
   If `GEMINI_API_KEY` is configured in `.env`, the retrieved live spatial statistics and top TF-IDF
   passages are injected as RAG context into Gemini 2.5 Flash for open-domain synthesis.
"""

import ast
import json
import math
import operator
import re
import urllib.request
from collections import Counter
from typing import Any
from app.config import PROJECT_ROOT, get_settings

settings = get_settings()
SEED_PATH = PROJECT_ROOT / "frontend" / "public" / "geo" / "nigeria_incidents_seed.json"
NEWS_PATH = PROJECT_ROOT / "frontend" / "src" / "data" / "researchedNewsSeed.json"
PLACES_PATH = PROJECT_ROOT / "frontend" / "public" / "geo" / "nigeria_cities_detail.json"

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "in", "on", "at",
    "to", "for", "of", "with", "by", "about", "as", "into", "like", "through", "after",
    "over", "between", "out", "against", "during", "without", "before", "under", "around",
    "among", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "do",
    "does", "did", "doing", "have", "has", "had", "having", "can", "could", "will", "would",
    "should", "tell", "me", "please", "give", "show", "explain", "how", "why", "where", "when",
    "and", "or", "but", "if", "so", "my", "your", "our", "their", "it", "its", "i", "you",
}

STATE_CAPITALS: dict[str, tuple[str, str, float, float]] = {
    "Abia": ("Umuahia", "South-East", 5.5250, 7.4896),
    "Adamawa": ("Yola", "North-East", 9.2035, 12.4954),
    "Akwa Ibom": ("Uyo", "South-South", 5.0377, 7.9128),
    "Anambra": ("Awka", "South-East", 6.2105, 7.0723),
    "Bauchi": ("Bauchi", "North-East", 10.3158, 9.8442),
    "Bayelsa": ("Yenagoa", "South-South", 4.9247, 6.2642),
    "Benue": ("Makurdi", "North-Central", 7.7322, 8.5391),
    "Borno": ("Maiduguri", "North-East", 11.8311, 13.1510),
    "Cross River": ("Calabar", "South-South", 4.9757, 8.3417),
    "Delta": ("Asaba", "South-South", 6.1982, 6.7333),
    "Ebonyi": ("Abakaliki", "South-East", 6.3249, 8.1137),
    "Edo": ("Benin City", "South-South", 6.3350, 5.6037),
    "Ekiti": ("Ado-Ekiti", "South-West", 7.6211, 5.2215),
    "Enugu": ("Enugu", "South-East", 6.4584, 7.5464),
    "FCT Abuja": ("Abuja", "North-Central", 9.0765, 7.3986),
    "Gombe": ("Gombe", "North-East", 10.2897, 11.1673),
    "Imo": ("Owerri", "South-East", 5.4836, 7.0333),
    "Jigawa": ("Dutse", "North-West", 11.7562, 9.3389),
    "Kaduna": ("Kaduna", "North-West", 10.5105, 7.4165),
    "Kano": ("Kano", "North-West", 12.0022, 8.5920),
    "Katsina": ("Katsina", "North-West", 12.9908, 7.6018),
    "Kebbi": ("Birnin Kebbi", "North-West", 12.4539, 4.1975),
    "Kogi": ("Lokoja", "North-Central", 7.8023, 6.7430),
    "Kwara": ("Ilorin", "North-Central", 8.4966, 4.5421),
    "Lagos": ("Ikeja", "South-West", 6.5244, 3.3792),
    "Nasarawa": ("Lafia", "North-Central", 8.4966, 8.5156),
    "Niger": ("Minna", "North-Central", 9.6139, 6.5569),
    "Ogun": ("Abeokuta", "South-West", 7.1475, 3.3619),
    "Ondo": ("Akure", "South-West", 7.2571, 5.2058),
    "Osun": ("Osogbo", "South-West", 7.7827, 4.5418),
    "Oyo": ("Ibadan", "South-West", 7.3775, 3.9470),
    "Plateau": ("Jos", "North-Central", 9.8965, 8.8583),
    "Rivers": ("Port Harcourt", "South-South", 4.8156, 7.0498),
    "Sokoto": ("Sokoto", "North-West", 13.0059, 5.2476),
    "Taraba": ("Jalingo", "North-East", 8.8937, 11.3596),
    "Yobe": ("Damaturu", "North-East", 11.7470, 11.9608),
    "Zamfara": ("Gusau", "North-West", 12.1702, 6.6641),
}

CAT_LABELS = {
    "power_outage": "⚡ Power Outage",
    "flood": "🌊 Flood",
    "kidnapping_security": "🛡️ Security Alert",
    "road_condition": "🛣️ Road Hazard",
    "disaster_fire": "🔥 Fire / Disaster",
    "other": "📢 Public Advisory",
}

TRAINING_CORPUS = [
    {
        "topic": "Emergency Numbers & Hotlines in Nigeria",
        "keywords": "emergency number hotline call police ambulance fire frsc nema lasema ncdc help 112 767 122",
        "answer": (
            "### ☎️ Official Nigerian Emergency Hotlines\n"
            "- **National Emergency Toll-Free (All States):** `112`\n"
            "- **Lagos Emergency (LASEMA / Police / Fire / Ambulance):** `767` or `112`\n"
            "- **Federal Road Safety Corps (FRSC Highway Crash/Gridlock):** `122`\n"
            "- **NCDC Public Health / Disease Alert (Cholera, Lassa):** `6232`\n"
            "- **NEMA National Situational Room:** `0800-CALL-NEMA` (`0800-2255-6362`)\n"
            "- **FCT Abuja Emergency (FEMA):** `112` / `0809-993-6362`\n\n"
            "💡 *Tip:* If you have weak mobile data, tap the **SMS** pill in the top bar to send a zero-internet SMS report directly into Naija Pulse."
        ),
    },
    {
        "topic": "Flood Safety & Survival Protocol (NEMA / NIHSA)",
        "keywords": "flood safety survival water rain submerged car house drown river dam nema nihsa",
        "answer": (
            "### 🌊 Flood Survival & Safety Protocol\n"
            "1. **Never drive or wade through moving floodwater:** Just **15 cm (6 inches)** of fast-moving water can knock an adult off their feet, and **30–45 cm** can float or sweep away a sedan or SUV.\n"
            "2. **Switch off electricity at the main breaker** if water approaches floor level to prevent electrocution.\n"
            "3. **Avoid open roadside gutters & unmarked culverts** (major hazard along Lagos, Aba, Akure, Lokoja, and Port Harcourt roads during downpours).\n"
            "4. **Boil or chlorinate drinking water** afterward to prevent waterborne cholera contamination.\n"
            "5. Use Naija Pulse's **Route Escort** tab before driving to scan H3 hexagons along your path for active flood alerts."
        ),
    },
    {
        "topic": "Tanker Explosion, Market Fire & Gas Leak Safety",
        "keywords": "fire safety tanker explosion petrol diesel spill market generator gas leak burn lasema",
        "answer": (
            "### 🔥 Tanker Spill & Market Fire Safety Guide\n"
            "1. **Evacuate at least 300–500 metres upwind immediately** from any overturned fuel tanker—**NEVER scoop spilled fuel**, as invisible petrol vapour ignites from static electricity, hot exhausts, or phones.\n"
            "2. **Never refuel a hot or running generator** (a leading cause of Nigerian market and residential infernos).\n"
            "3. **Electrical surges:** Install surge protectors and switch off heavy appliances during power outages so grid restoration surges do not spark fires.\n"
            "4. Call **`112`** (Nationwide) or **`767`** (Lagos) immediately and drop a **Fire / Disaster** pin on Naija Pulse to warn approaching motorists."
        ),
    },
    {
        "topic": "Highway Security & Kidnapping Prevention Protocol",
        "keywords": "security kidnap kidnapping bandit highway safe travel night convoy escort katari zamfara",
        "answer": (
            "### 🛡️ Nigerian Inter-State Highway Safety Protocol\n"
            "1. **Strictly avoid night or dusk inter-state travel** on high-risk corridors; plan departures between **7:00 AM and 2:00 PM**.\n"
            "2. **Run a Route Escort scan first:** Open the **Route Escort** tab in Naija Pulse to check every Uber H3 hexagon along your route against live citizen reports and historical ACLED risk priors.\n"
            "3. **Share live trip details** with trusted family and watch for official military/police checkpoints.\n"
            "4. **Privacy protection:** Naija Pulse automatically blurs all `kidnapping_security` coordinates to the **Resolution-7 H3 macro centroid (~1.2 km)** and strips photo EXIF/GPS metadata so reporters and victims cannot be targeted."
        ),
    },
    {
        "topic": "Nigerian Power Grid, TCN, NISO & DisCos Explained",
        "keywords": "power outage electricity national grid collapse tcn niso disco band tariff megawatt ikedc ekedc aedc",
        "answer": (
            "### ⚡ Nigeria's Power Grid & DisCo Structure\n"
            "- **Generation (GenCos):** Thermal gas plants (Egbin, Geregu, Azura, Afam, Okpai) + Hydro dams (Kainji, Jebba, Shiroro, Zungeru) typically generate **3,500–4,800 MW**.\n"
            "- **Transmission (TCN & NISO):** High-voltage **330kV and 132kV** lines wheel bulk power nationwide; line trips or gas drops trigger partial/system disturbances.\n"
            "- **11 Regional DisCos:** Ikeja Electric (`IKEDC`), Eko (`EKEDC`), Abuja (`AEDC`), Ibadan (`IBEDC`), Benin (`BEDC`), Enugu (`EEDC`), Port Harcourt (`PHED`), Kano (`KEDCO`), Kaduna (`KAEDCO`), Jos (`JEDC`), and Yola (`YEDC`).\n"
            "- **NERC Service Bands:** **Band A** (min. 20 hrs/day), **Band B** (16+ hrs), **Band C** (12+ hrs), **Band D** (8+ hrs), **Band E** (4+ hrs)."
        ),
    },
    {
        "topic": "How Naija Pulse Works (Architecture, H3 & Bayesian Trust)",
        "keywords": "naija pulse architecture how work trust score bayesian uber h3 hexagon algorithm fake news",
        "answer": (
            "### 🧠 How Naija Pulse Works Under the Hood\n"
            "1. **Uber H3 Discrete Global Grid:** Indexes Nigeria into hexagonal cells—**Res 5** (~8.5 km national clusters), **Res 7** (~1.2 km privacy-blurred security zones), and **Res 8** (~460 m neighborhood cells).\n"
            "2. **Distance-Weighted Bayesian Trust Scoring:** Every confirm (`+1`) or dispute (`-1`) vote is weighted by **Cauchy distance decay** $w(d) = \\frac{1}{1 + (d/500)^2}$ multiplied by **Laplace-smoothed reporter reputation**. Someone standing 100m away carries **96% weight**, while a troll 5 km away carries **<1% weight**.\n"
            "3. **Zero-Login Privacy & EXIF Stripping:** Uses a local device UUID (`X-Reporter-Token`) and strips all camera EXIF/GPS tags via HTML5 Canvas + Python Pillow.\n"
            "4. **Agency Command HQ:** Triages all **800+ live incidents** across all **36 States + FCT** for NEMA, TCN/DisCos, FRSC, Fire Service, and Security teams."
        ),
    },
    {
        "topic": "Geography, Topography, Rivers & 6 Geopolitical Zones of Nigeria",
        "keywords": "nigeria geography states geopolitical zones rivers niger benue lokoja mountain chappal waddi population",
        "answer": (
            "### 🇳🇬 Geography & Physical Relief of Nigeria\n"
            "- **Administrative Structure:** **36 States + Federal Capital Territory (Abuja)** subdivided into **774 Local Government Areas (LGAs)** across **6 Geopolitical Zones** (`North-West`, `North-East`, `North-Central`, `South-West`, `South-East`, `South-South`).\n"
            "- **Major Rivers & Lakes:** **River Niger** and **River Benue** meet at the famous **Lokoja Confluence** (Kogi State) and empty through the **Niger Delta** into the Gulf of Guinea. Other major waters include Rivers Kaduna, Sokoto, Gongola, Cross, Komadugu Yobe, **Kainji Reservoir**, **Lake Chad**, and **Lagos Lagoon**.\n"
            "- **Highest Peak & Highlands:** **Chappal Waddi (2,419 m)** on the Mambilla Plateau (Taraba State), followed by the **Jos Plateau** (Shere Hills, 1,829 m), **Obudu Plateau** (1,716 m), **Adamawa Highlands**, and **Idanre Hills**."
        ),
    },
    {
        "topic": "Public Health, Cholera & Water Sanitation (NCDC)",
        "keywords": "health cholera lassa malaria water boil sanitation hospital ncdc outbreak disease",
        "answer": (
            "### 🏥 Public Health & Water Safety Advisory (NCDC)\n"
            "- **Preventing Cholera & Waterborne Illness:** During heavy rains, burst water pipes near open gutters can cross-contaminate supply. Always **boil water for 1 minute**, use certified water-purification tablets, wash hands with soap, and wash fruits/vegetables with safe water.\n"
            "- **Oral Rehydration Solution (ORS):** For sudden watery diarrhoea, start **ORS** immediately (or mix 6 level teaspoons of sugar + 1/2 level teaspoon of salt in 1 litre of clean boiled water) and get to a hospital.\n"
            "- **NCDC 24/7 Toll-Free Line:** Call **`6232`** to report suspected outbreaks."
        ),
    },
    {
        "topic": "Using the Agency Command Dashboard",
        "keywords": "agency dashboard command dispatch resolve export csv sitrep triage nema frsc",
        "answer": (
            "### 🏛️ How to Use the Agency HQ Dashboard\n"
            "Open the **Agency HQ** tab in the bottom navigation bar to:\n"
            "1. **Switch Agency Desk:** Filter automatically for **NEMA/SEMA** (Floods), **TCN & DisCos** (Power), **FRSC/LASTMA** (Roads), **Fire/LASEMA**, **Security/JTF**, or **Joint National Command**.\n"
            "2. **Inspect All 36 States + FCT:** View live incident counts ($\\ge 21$ per state), severity rankings, and category breakdowns across all 6 geopolitical zones.\n"
            "3. **Dispatch & Resolve:** Click **Dispatch Unit** to assign a field team, **Resolve** to clear a hazard from the live map, **Locate** to fly straight to its street/LGA, or **Export CSV SitRep** for official reporting."
        ),
    },
    {
        "topic": "Offline & SMS Reporting on Naija Pulse",
        "keywords": "sms offline no internet low data ussd report webhook",
        "answer": (
            "### 📲 Reporting Without Internet (SMS / Low-Data Mode)\n"
            "When cellular data is congested or unavailable:\n"
            "1. Tap the **SMS** button in the top header bar.\n"
            "2. Send a structured text message such as `FLOOD LOKOJA Ganaja road submerged near bridge`.\n"
            "3. Our `/api/v1/webhooks/sms` gateway parses the category and location, snaps it to its Uber H3 hexagon, and publishes it to the live map and Agency HQ queue."
        ),
    },
    {
        "topic": "Artificial Intelligence, Machine Learning & Software Engineering",
        "keywords": "python react fastapi postgis machine learning ai code programming database sql",
        "answer": (
            "### 💻 Tech Stack & AI Architecture\n"
            "- **Frontend:** React 19 + Vite + Leaflet Custom Vector Atlas (36 States, 774 LGAs, Street Grids, Rivers & Hypsometric Relief) + `h3-js` + Tailwind CSS v4.\n"
            "- **Backend:** Python FastAPI + `asyncpg` + PostgreSQL 18 + PostGIS (`GEOGRAPHY(Point, 4326)`) + Shapely + Pillow.\n"
            "- **PulseAI Engine:** Hybrid **Sublinear TF-IDF Unigram/Bigram Cosine-Similarity Vector Retriever** coupled with a **Live Spatial & Statistical RAG Engine** over 830+ Nigerian incidents (with optional Gemini 2.5 Flash LLM synthesis)."
        ),
    },
]


def _tokenize(text: str) -> list[str]:
    words = [w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if w not in STOPWORDS and len(w) > 1]
    bigrams = [f"{words[i]}_{words[i + 1]}" for i in range(len(words) - 1)]
    return words + bigrams


class TrainedTfidfIndex:
    """Lightweight, pure-Python L2-normalized Sublinear TF-IDF Vector Index."""

    def __init__(self, docs: list[dict[str, str]]):
        self.docs = docs
        self.n_docs = len(docs)
        doc_tokens = [_tokenize(f"{d['topic']} {d['keywords']} {d['keywords']} {d['answer']}") for d in docs]

        df: Counter[str] = Counter()
        for toks in doc_tokens:
            for term in set(toks):
                df[term] += 1

        self.idf = {
            term: math.log((self.n_docs + 1) / (count + 1)) + 1.0
            for term, count in df.items()
        }
        self.doc_vecs = [self._vectorize(toks) for toks in doc_tokens]

    def _vectorize(self, tokens: list[str]) -> dict[str, float]:
        tf = Counter(tokens)
        vec: dict[str, float] = {}
        norm_sq = 0.0
        for term, count in tf.items():
            idf = self.idf.get(term)
            if idf is None:
                continue
            w = (1.0 + math.log(count)) * idf
            vec[term] = w
            norm_sq += w * w
        norm = math.sqrt(norm_sq) or 1.0
        return {t: w / norm for t, w in vec.items()}

    def search(self, query: str, top_k: int = 2) -> list[tuple[float, dict[str, str]]]:
        q_vec = self._vectorize(_tokenize(query))
        if not q_vec:
            return []
        scored = []
        for vec, doc in zip(self.doc_vecs, self.docs):
            sim = sum(qw * vec.get(t, 0.0) for t, qw in q_vec.items())
            if sim > 0.0:
                scored.append((sim, doc))
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[:top_k]


_INDEX = TrainedTfidfIndex(TRAINING_CORPUS)
_CACHED_SEED: list[dict[str, Any]] | None = None
_CACHED_NEWS: list[dict[str, Any]] | None = None
_CACHED_PLACES: list[dict[str, Any]] | None = None


def load_seed_incidents() -> list[dict[str, Any]]:
    global _CACHED_SEED
    if _CACHED_SEED is None and SEED_PATH.exists():
        _CACHED_SEED = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    return _CACHED_SEED or []


def load_news_items() -> list[dict[str, Any]]:
    global _CACHED_NEWS
    if _CACHED_NEWS is None and NEWS_PATH.exists():
        try:
            _CACHED_NEWS = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            _CACHED_NEWS = []
    return _CACHED_NEWS or []


def load_places() -> list[dict[str, Any]]:
    global _CACHED_PLACES
    if _CACHED_PLACES is None and PLACES_PATH.exists():
        try:
            payload = json.loads(PLACES_PATH.read_text(encoding="utf-8"))
            _CACHED_PLACES = payload.get("places", [])
        except (OSError, json.JSONDecodeError):
            _CACHED_PLACES = []
    return _CACHED_PLACES or []


def _safe_eval_math(expr: str) -> float | None:
    """Safely evaluates arithmetic questions like 'what is (24 * 37) + 150?' without eval()."""
    cleaned = re.sub(r"[^0-9+\-*/().%\s]", "", expr).strip()
    if not cleaned or not re.search(r"\d+\s*[+\-*/%]\s*\d+", cleaned):
        return None
    ops = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Mod: operator.mod,
        ast.USub: operator.neg,
    }

    def _eval(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in ops:
            return ops[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in ops:
            return ops[type(node.op)](_eval(node.operand))
        raise ValueError("Unsupported")

    try:
        tree = ast.parse(cleaned, mode="eval")
        return round(_eval(tree.body), 4)
    except Exception:
        return None


def _detect_states(q_lower: str) -> list[str]:
    matched = []
    for st, (cap, _, _, _) in STATE_CAPITALS.items():
        st_clean = st.lower().replace("fct ", "")
        if re.search(r"\b" + re.escape(st_clean) + r"\b", q_lower) or (
            len(cap) >= 3 and re.search(r"\b" + re.escape(cap.lower()) + r"\b", q_lower)
        ):
            matched.append(st)
    if "abuja" in q_lower or "fct" in q_lower:
        if "FCT Abuja" not in matched:
            matched.append("FCT Abuja")
    return matched


def _detect_category(q_lower: str) -> str | None:
    rules = [
        ("power_outage", ["power", "blackout", "electricity", "light", "nepa", "disco", "grid", "transformer"]),
        ("flood", ["flood", "flooding", "rain", "submerged", "water level", "drainage"]),
        ("kidnapping_security", ["kidnap", "security", "bandit", "gunmen", "robbery", "safe to travel", "attack"]),
        ("disaster_fire", ["fire", "tanker", "explosion", "inferno", "burn"]),
        ("road_condition", ["road", "traffic", "gridlock", "pothole", "bridge", "holdup", "expressway"]),
    ]
    for code, kws in rules:
        if any(k in q_lower for k in kws):
            return code
    return None


def _try_gemini_rag(question: str, spatial_context: str, kb_context: str) -> str | None:
    if not settings.GEMINI_API_KEY:
        return None
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    )
    prompt = (
        "You are PulseAI, the intelligent civic, safety, geospatial, and general-knowledge assistant "
        "for Naija Pulse (Nigeria's real-time community incident & area intelligence platform). "
        "Answer ANY question the user asks clearly, concisely, and helpfully using Markdown. "
        "When the question relates to Nigeria, states, roads, safety, power, or floods, ground your "
        "answer in the LIVE NAIJA PULSE DATA below.\n\n"
        f"LIVE NAIJA PULSE DATA:\n{spatial_context}\n\n"
        f"REFERENCE KNOWLEDGE:\n{kb_context}\n\n"
        f"USER QUESTION: {question}"
    )
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
            return payload["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return None


def answer_question(question: str, client_incidents: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    q = (question or "").strip()
    if not q:
        return {
            "reply": "Ask me anything—live incidents in any of Nigeria's **36 States + FCT**, route safety, power/flood stats, emergency hotlines, or general questions!",
            "engine": "PulseAI Hybrid RAG",
            "map_action": None,
        }

    q_lower = q.lower()
    incidents = client_incidents if client_incidents else load_seed_incidents()
    total_inc = len(incidents)
    by_state: dict[str, list[dict[str, Any]]] = {}
    by_cat: Counter[str] = Counter()
    for inc in incidents:
        st = inc.get("state_name") or "Nigeria"
        by_state.setdefault(st, []).append(inc)
        by_cat[inc.get("category_code", "other")] += 1

    # 1. Check greeting / identity
    if re.match(r"^(hi|hello|hey|good morning|good afternoon|good evening|howfar|how far|wetin|who are you)\b", q_lower):
        return {
            "reply": (
                f"Hello! I'm **PulseAI**, Naija Pulse's trained civic & general intelligence assistant.\n\n"
                f"Right now I am monitoring **{total_inc} active & verified incidents** across **all 36 Nigerian States + FCT Abuja**.\n\n"
                "You can ask me:\n"
                "- **Live State/City Situation:** *\"What is happening in Kano / Borno / Lagos / Rivers?\"*\n"
                "- **National Analytics:** *\"Which states have the most floods or power outages?\"*\n"
                "- **Safety & Hotlines:** *\"Is Abuja–Kaduna highway safe?\"* or *\"Nigeria emergency numbers\"*\n"
                "- **General & Technical Questions:** Geography, capitals, calculations, health, or how our **Uber H3 + Bayesian trust** algorithms work!"
            ),
            "engine": "PulseAI Hybrid RAG",
            "map_action": None,
        }

    # 2. Check arithmetic / quick calculation
    math_val = _safe_eval_math(q)
    if math_val is not None and any(w in q_lower for w in ["calculate", "what is", "solve", "+", "*", "/", "-"]):
        return {
            "reply": f"### 🧮 Calculation Result\n`{q.strip()}` = **`{math_val:g}`**",
            "engine": "PulseAI Math & Logic",
            "map_action": None,
        }

    matched_states = _detect_states(q_lower)
    matched_cat = _detect_category(q_lower)
    kb_hits = _INDEX.search(q, top_k=2)
    kb_context = "\n\n".join(doc["answer"] for _, doc in kb_hits)

    # Newsroom retrieval: keep headlines and summaries separate from incident
    # confidence so readers can see that a news story is sourced reporting.
    if any(token in q_lower for token in ("news", "headline", "headlines", "latest story", "latest stories", "news update")):
        news = load_news_items()
        if matched_states:
            news = [item for item in news if item.get("state_name") in matched_states] or news
        news = news[:6]
        bullets = "\n".join(
            f"- **{item.get('title')}** — *{item.get('news_outlet') or item.get('source') or 'Newsroom'}* ({item.get('state_name') or 'Nigeria'})\n  {item.get('summary') or ''}"
            for item in news
        )
        first = news[0] if news else {}
        return {
            "reply": f"### 📰 Nigeria News Desk\n{bullets or '- No cached headlines match that request.'}\n\n*Open the News tab to search the full feed and open original sources.*",
            "engine": "PulseAI News Retrieval",
            "map_action": ({"label": f"View news near {first.get('lga_name') or first.get('state_name')}", "lat": first.get("lat", 9.08), "lng": first.get("lng", 8.68), "zoom": 11} if first else None),
        }

    # Discovery retrieval: use the atlas for fun, cultural, natural, and civic places.
    if any(token in q_lower for token in ("fun place", "interesting place", "where to visit", "tourist", "beach", "museum", "park", "waterfall", "landmark", "things to do")):
        places = load_places()
        if matched_states:
            state_name = matched_states[0].replace("FCT ", "")
            places = [p for p in places if state_name.lower() in str(p.get("sub", "")).lower()] or places
        query_words = [word for word in re.findall(r"[a-z]+", q_lower) if len(word) > 3]
        if query_words:
            matched = [p for p in places if any(word in f"{p.get('name', '')} {p.get('kind', '')} {p.get('sub', '')}".lower() for word in query_words)]
            if matched:
                places = matched
        places = places[:6]
        bullets = "\n".join(f"- **{p.get('name')}** — {p.get('kind', 'place')} ({p.get('sub', 'Nigeria')})" for p in places)
        first = places[0] if places else {}
        return {
            "reply": f"### ✨ Places to Explore\n{bullets or '- No atlas places matched that request.'}\n\n*Open Explore Places for searchable cards and map navigation.*",
            "engine": "PulseAI Nigeria Places Atlas",
            "map_action": ({"label": f"Explore {first.get('name')}", "lat": first.get("lat", 9.08), "lng": first.get("lng", 8.68), "zoom": 13} if first else None),
        }

    # Build concise spatial summary for RAG / direct response
    spatial_summary_lines = [
        f"Total nationwide active incidents: {total_inc} across {len(by_state)} States+FCT.",
        "Category totals: " + ", ".join(f"{k}={v}" for k, v in by_cat.most_common()),
    ]
    map_action = None

    if matched_states:
        st0 = matched_states[0]
        cap, zone, s_lat, s_lng = STATE_CAPITALS[st0]
        map_action = {"label": f"Fly to {st0} on Map", "lat": s_lat, "lng": s_lng, "zoom": 9}
        for st in matched_states[:2]:
            s_list = by_state.get(st, [])
            spatial_summary_lines.append(
                f"{st} ({STATE_CAPITALS[st][1]}, Capital: {STATE_CAPITALS[st][0]}): {len(s_list)} incidents."
            )
            for sample in s_list[:4]:
                spatial_summary_lines.append(
                    f" - [{sample.get('category_code')}] {sample.get('title')} ({sample.get('lga_name')}, trust={sample.get('trust_score')})"
                )

    # Try optional Gemini LLM synthesis if API key is set
    llm_reply = _try_gemini_rag(q, "\n".join(spatial_summary_lines), kb_context)
    if llm_reply:
        return {"reply": llm_reply, "engine": "PulseAI · Gemini 2.5 RAG", "map_action": map_action}

    # 3. State-specific intelligence query (e.g. "What is happening in Borno / Kano / Lagos?" or "Capital of Taraba?")
    if matched_states:
        sections = []
        for st in matched_states[:2]:
            cap, zone, s_lat, s_lng = STATE_CAPITALS[st]
            if "capital" in q_lower and not matched_cat and "incident" not in q_lower and "happening" not in q_lower:
                sections.append(
                    f"### 📍 {st}\n"
                    f"- **Capital City:** {cap}\n"
                    f"- **Geopolitical Zone:** {zone}\n"
                    f"- **Live Naija Pulse Incidents:** **{len(by_state.get(st, []))} active reports** currently tracked across {st} LGAs."
                )
                continue

            s_list = by_state.get(st, [])
            filtered = [i for i in s_list if not matched_cat or i.get("category_code") == matched_cat]
            cat_counts = Counter(i.get("category_code", "other") for i in s_list)
            breakdown = " · ".join(f"{CAT_LABELS.get(k, k)}: **{v}**" for k, v in cat_counts.most_common())
            top_items = sorted(filtered or s_list, key=lambda x: float(x.get("trust_score", 0)), reverse=True)[:4]
            bullets = "\n".join(
                f"- **{CAT_LABELS.get(it.get('category_code'), 'Alert')}** — *{it.get('title')}* "
                f"(`{it.get('lga_name', st)}`, Trust **{int(float(it.get('trust_score', 0.8)) * 100)}%**)"
                for it in top_items
            )
            sections.append(
                f"### 📡 {st} Live Intelligence ({zone} · Capital: {cap})\n"
                f"**{len(s_list)} active incidents** across {st} ({breakdown}).\n\n"
                f"**Top Verified Reports{f' ({CAT_LABELS[matched_cat]})' if matched_cat else ''}:**\n{bullets}"
            )
        if kb_hits and kb_hits[0][0] >= 0.26 and ("safe" in q_lower or "what should" in q_lower or "emergency" in q_lower):
            sections.append(kb_hits[0][1]["answer"])
        return {
            "reply": "\n\n".join(sections),
            "engine": "PulseAI Spatial Intelligence",
            "map_action": map_action,
        }

    # 4. National ranking / category / statistics query ("which state has most...", "how many incidents...", "flood report")
    if any(w in q_lower for w in ["how many", "total", "most", "highest", "summary", "nationwide", "all states", "statistics", "stats"]) or (
        matched_cat and any(w in q_lower for w in ["where", "which", "active", "report", "list", "status", "today", "now"])
    ):
        if matched_cat:
            cat_inc = [i for i in incidents if i.get("category_code") == matched_cat]
            state_rank = Counter(i.get("state_name", "Nigeria") for i in cat_inc).most_common(6)
            rank_str = ", ".join(f"**{st}** ({cnt})" for st, cnt in state_rank)
            highlights = "\n".join(
                f"- **{i.get('state_name')} ({i.get('lga_name')}):** {i.get('title')} *(Trust {int(float(i.get('trust_score', 0.8))*100)}%)*"
                for i in cat_inc[:5]
            )
            extra_tip = f"\n\n{kb_hits[0][1]['answer']}" if kb_hits and kb_hits[0][0] >= 0.22 else ""
            return {
                "reply": (
                    f"### 📊 Nationwide {CAT_LABELS[matched_cat]} SitRep\n"
                    f"- **Active {CAT_LABELS[matched_cat]} Incidents:** **{len(cat_inc)}** out of {total_inc} nationwide\n"
                    f"- **Top Affected States:** {rank_str}\n\n"
                    f"**Latest High-Trust Alerts:**\n{highlights}{extra_tip}"
                ),
                "engine": "PulseAI Spatial Analytics",
                "map_action": {"label": "View Full Nigeria Atlas", "lat": 9.08, "lng": 8.68, "zoom": 6},
            }

        top_states = sorted(by_state.items(), key=lambda kv: len(kv[1]), reverse=True)[:6]
        top_str = ", ".join(f"**{st}** ({len(lst)})" for st, lst in top_states)
        cat_str = "\n".join(f"- {CAT_LABELS.get(k, k)}: **{v}** incidents" for k, v in by_cat.most_common())
        return {
            "reply": (
                f"### 🇳🇬 Nationwide Situation Summary\n"
                f"Naija Pulse is currently tracking **{total_inc} active incidents** across **all {len(by_state)} States + FCT** (minimum 21+ per state).\n\n"
                f"**Breakdown by Category:**\n{cat_str}\n\n"
                f"**Highest-Volume States:** {top_str}\n\n"
                f"Open the **Agency HQ** tab to triage, dispatch units, or export a CSV SitRep!"
            ),
            "engine": "PulseAI Spatial Analytics",
            "map_action": {"label": "View Full Nigeria Atlas", "lat": 9.08, "lng": 8.68, "zoom": 6},
        }

    # 5. Trained TF-IDF Knowledge Base Match
    if kb_hits and kb_hits[0][0] >= 0.14:
        return {
            "reply": kb_hits[0][1]["answer"],
            "engine": f"PulseAI Trained TF-IDF (sim={kb_hits[0][0]:.2f})",
            "map_action": None,
        }

    # 6. Substring search across all 836 incident titles/LGAs (e.g. "Otedola", "Surulere", "Third Mainland", "Singer Market")
    q_words = [w for w in re.findall(r"[a-z0-9]+", q_lower) if w not in STOPWORDS and len(w) >= 3]
    if q_words:
        scored_inc = []
        for inc in incidents:
            hay = f"{inc.get('title', '')} {inc.get('summary', '')} {inc.get('lga_name', '')} {inc.get('state_name', '')}".lower()
            hits = sum(1 for w in q_words if w in hay)
            if hits > 0:
                scored_inc.append((hits, inc))
        scored_inc.sort(key=lambda x: (x[0], float(x[1].get("trust_score", 0))), reverse=True)
        if scored_inc:
            best = [inc for _, inc in scored_inc[:4]]
            first = best[0]
            lat = float(first.get("latitude") or first.get("lat") or 9.08)
            lng = float(first.get("longitude") or first.get("lng") or 8.68)
            lines = "\n".join(
                f"- **{CAT_LABELS.get(b.get('category_code'), 'Alert')} ({b.get('lga_name')}, {b.get('state_name')}):** {b.get('title')} — *{b.get('summary')}*"
                for b in best
            )
            return {
                "reply": f"### 🔎 Matching Live Field Reports ({len(scored_inc)} found)\n{lines}",
                "engine": "PulseAI Field Search",
                "map_action": {
                    "label": f"Locate {first.get('lga_name', 'Incident')} on Map",
                    "lat": lat,
                    "lng": lng,
                    "zoom": 12,
                },
            }

    # 7. Graceful General Assistant Fallback
    return {
        "reply": (
            f"### 🤖 PulseAI Response\n"
            f"I searched our **836+ live Nigerian incidents** and trained civic safety corpus for *\"{q}\"*.\n\n"
            f"- **Nationwide Status:** **{total_inc} active incidents** across all **36 States + FCT** ({by_cat['power_outage']} Power, {by_cat['road_condition']} Road, {by_cat['flood']} Flood, {by_cat['disaster_fire']} Fire, {by_cat['kidnapping_security']} Security).\n"
            f"- **Emergency Line:** Dial **`112`** (Nationwide) or **`122`** (FRSC).\n"
            f"- **Tip:** Ask me about any **Nigerian State** (e.g. *\"Borno incidents\"*, *\"Rivers flood\"*, *\"Capital of Ekiti\"*), **safety protocols**, **math calculations**, or add a `GEMINI_API_KEY` in `.env` to unlock unlimited open-world LLM generation!"
        ),
        "engine": "PulseAI Hybrid Assistant",
        "map_action": None,
    }
