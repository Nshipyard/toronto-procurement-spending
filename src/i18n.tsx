"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "en" | "fr";

const en = {
  banner: {
    line: "An open-source civic project. Not affiliated with the Government of Canada or the City of Toronto.",
    badge: "Open source",
  },
  nav: { explorer: "Explorer", showcase: "Showcase", developers: "Developers", data: "Data", back: "All projects" },
  hero: {
    kicker: "Nshipyard Canada · Project 09",
    title: "Who gets the city's money.",
    sub: "Toronto publishes every awarded contract, but the same vendor hides behind 4,240 different spellings, and three award values are phone numbers typed into the amount field. This project resolves the names into 4,082 canonical vendors and quarantines the defects: $21.5B in awards from 2012 to 2026, searchable by vendor, split between competitive and non-competitive.",
    cta1: "Search the vendors",
    cta2: "Read the methodology",
  },
  stats: [
    { value: "$21.5B", label: "in awarded contracts and consulting spend, 2012-2026, across 13,084 records" },
    { value: "4,082", label: "canonical vendors resolved from 4,240 raw name spellings, with 174 fuzzy merges logged for audit" },
    { value: "20.8%", label: "of all spend captured by the top 10 vendors" },
    { value: "90.1%", label: "of spend awarded competitively; non-competitive contracts are 8.5%" },
  ],
  explorer: {
    kicker: "Explorer",
    title: "Search 4,082 vendors.",
    search: "Search by vendor name…",
    showing: "Showing",
    of: "of",
    noResult: "No vendors match.",
    empty: "Search by vendor name above to browse the canonical vendor file. Each vendor merges every spelling the source data used for it.",
    spend: "Total spend",
    awards: "awards",
    years: "Years active",
    variants: "name variants merged",
    topAwards: "Largest awards",
    categories: "Categories",
    kinds: { competitive: "Competitive", "non-competitive": "Non-competitive", consulting: "Consulting" },
    back: "Back to results",
    vendorId: "Vendor ID",
  },
  showcase: {
    kicker: "Showcase",
    title: "Where $21.5B goes.",
    body: "The top 10 vendors captured 20.8% of everything the city awarded. Construction dominates: $13.0B of $21.5B, led by road and sewer contractors whose names appear dozens of times under slightly different spellings. The raw files list vendors; they cannot tell you who the city keeps paying. Entity resolution can.",
    topTitle: "Top 15 vendors by total awards",
    topSub: "Canonical vendors, 2012-2026. Sanscon's 109 awards were filed under “Limited” and “Ltd.” variants before merging.",
    spend: "spend",
    splitTitle: "Competitive vs non-competitive",
    splitBody: "90.1% of spend went through open competition ($19.4B). Non-competitive awards are 8.5% ($1.8B across 2,887 contracts). Emergencies lead the non-competitive reasons at $450M, followed by exclusive rights at $417M.",
    competitive: "Competitive",
    noncompetitive: "Non-competitive",
    consulting: "Consulting",
    reasonTitle: "Why contracts skip competition",
    reasonSub: "Non-competitive awards by stated reason, 2013-2026.",
    yearTitle: "Spend by year",
    yearSub: "Award values as published, 2012-2026. Multi-year awards appear in full in the award year.",
    catTitle: "Spend by category",
    catSub: "Toronto's own coarse coding; the source publishes no commodity codes.",
    repeatTitle: "Repeat winners",
    repeatBody: "72 vendors won 21 or more awards each. 2,268 vendors won exactly once. The city re-hires: repeat business is the norm, not the exception.",
    bucketLabels: ["1 award", "2-5 awards", "6-20 awards", "21+ awards"],
    vendors: "vendors",
    awardsLabel: "awards",
  },
  methodology: {
    kicker: "Methodology",
    title: "How the vendor file was built, and where it is weak.",
    items: [
      "Sources: three City of Toronto open-data packages retrieved 2026-10-08 from the CKAN datastore: awarded contracts (7,755 records), non-competitive contracts (2,937), and consulting expenditures 2012-2024 (3,187 rows across four workbooks). 13,084 records in total.",
      "Vendor entity resolution is deterministic and documented: names are uppercased, punctuation stripped, legal suffixes (Ltd, Inc, Corp and 12 more) dropped, then exact-matched; a fuzzy pass merges keys with difflib ratio 0.93 or higher sharing a first token. 4,240 raw spellings became 4,082 canonical vendors; all 174 merges are logged in vendor_merges.json.",
      "Three award records carried bare 10-digit integers in the amount field (9054510208, 4163927134, 1898820680): the pattern of phone numbers, not credible awards. They are quarantined and excluded from every total; without this the headline spend would be overstated by $15.1B.",
      "Amounts are award or expenditure values as published, not audited final payments. Multi-year awards appear in full in the award year, so year totals are commitment timing, not cash flow.",
      "Toronto publishes no commodity codes on award records. High Level Category is the source's own coarse coding. GSIN hints are keyword heuristics against the federal table with 1.8% coverage; they are suggestions, never classifications.",
      "The legacy wx.toronto.ca award postings were unreachable at build time, so the CKAN datastore dumps are the complete source used. Capital and procurement pipeline files describe planned work, not spending, and are excluded from all totals.",
      "Vendor identity has no business-number key in the source data, so merges are name-based and conservative. The variant table is the stable join key; vendor IDs regenerate on each rebuild.",
    ],
  },
  developers: {
    kicker: "For developers",
    title: "Query it from code, or from an agent.",
    body: "Three consumption paths, same canonical data. REST for applications, OpenAPI for integration, MCP tools over streamable HTTP for AI agents.",
    endpoints: "Endpoints",
    tryIt: "Try it",
    openapi: "OpenAPI spec",
    mcpTitle: "MCP server",
    mcpBody: "One streamable-HTTP endpoint. Tools: vendor_lookup, vendor_search, spend_summary.",
  },
  mcp: {
    kicker: "Connect your agent",
    title: "Put this data to work inside your AI tools.",
    body: "Pick your harness, copy the prompt, send it to your agent. Your agent runs the setup itself.",
    tabs: { chatgpt: "ChatGPT", claude: "Claude", claudecode: "Claude Code", cli: "CLI", other: "Other" },
    cardTitle: "Copy and send this to {tab}",
    copy: "Copy",
    copied: "Copied",
    chatgptNote: "ChatGPT connects through the documented REST API rather than MCP directly.",
    pChatgpt:
      "I want to use the {displayName} through its API.\n- OpenAPI spec: {origin}/api/openapi.json\n- REST base: {origin}/api/v1\nFirst tell me in two sentences what this API offers, then {exampleLower}, and show me the result.",
    pClaude:
      "In Claude (claude.ai), open Settings, then Connectors, and add a custom connector:\n- Name: {displayName}\n- URL: {origin}/mcp\nThen list the available tools, {exampleLower}, and show me the result.",
    pClaudeCode:
      "Set up the {displayName} MCP server so I can query it from here.\n1. Run: claude mcp add --transport http {slug} {origin}/mcp\n2. Run `claude mcp list` to confirm it connected.\n3. {example}, and show me the result.",
    pCli:
      "# MCP endpoint (streamable HTTP)\n{origin}/mcp\n\n# List the available tools\ncurl -s -X POST {origin}/mcp -H 'Content-Type: application/json' \\\n  -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}'",
    otherTitle: "Everything else",
    otherBody: "Any harness that speaks MCP over streamable HTTP, or plain REST.",
    mcpEndpoint: "MCP endpoint",
    openapiSpec: "OpenAPI spec",
    restBase: "REST base",
  },
  downloads: {
    kicker: "Data",
    title: "Take the files.",
    body: "The entity-resolution table and the full aggregate summary, MIT licensed, as CSV and JSON.",
    files: [
      { name: "vendor_variants.csv", desc: "4,240 raw vendor spellings mapped to 4,082 canonical vendor IDs" },
      { name: "summary.json", desc: "Spend aggregates by year, kind, category, division, and reason" },
    ],
    download: "Download",
  },
  footer: {
    line: "An open-source civic project. Not affiliated with the Government of Canada or the City of Toronto.",
    sources: "Award source: City of Toronto Open Data (CKAN): awarded contracts, non-competitive contracts, consulting expenditures. Commodity reference: federal GSIN table via toronto-civic-codebooks.",
  },
};

export type Dict = typeof en;

const fr: Dict = {
  banner: {
    line: "Un projet civique à code source ouvert. Sans affiliation avec le gouvernement du Canada ni la Ville de Toronto.",
    badge: "Code source ouvert",
  },
  nav: { explorer: "Explorateur", showcase: "Vitrine", developers: "Développeurs", data: "Données", back: "Tous les projets" },
  hero: {
    kicker: "Nshipyard Canada · Projet 09",
    title: "Qui reçoit l'argent de la ville.",
    sub: "Toronto publie chaque contrat attribué, mais un même fournisseur se cache derrière 4 240 orthographes différentes, et trois montants d'attribution sont des numéros de téléphone saisis dans le champ du montant. Ce projet ramène ces noms à 4 082 fournisseurs canoniques et met les défauts en quarantaine : 21,5 G$ d'attributions de 2012 à 2026, interrogeables par fournisseur, réparties entre concurrentiel et non concurrentiel.",
    cta1: "Rechercher les fournisseurs",
    cta2: "Lire la méthodologie",
  },
  stats: [
    { value: "21,5 G$", label: "de contrats attribués et de dépenses de consultation, 2012-2026, sur 13 084 dossiers" },
    { value: "4 082", label: "fournisseurs canoniques résolus à partir de 4 240 orthographes brutes, avec 174 fusions floues consignées pour audit" },
    { value: "20,8 %", label: "de toutes les dépenses captées par les 10 premiers fournisseurs" },
    { value: "90,1 %", label: "des dépenses attribuées en concurrence; les contrats non concurrentiels représentent 8,5 %" },
  ],
  explorer: {
    kicker: "Explorateur",
    title: "Recherchez parmi 4 082 fournisseurs.",
    search: "Rechercher par nom de fournisseur…",
    showing: "Affichage de",
    of: "sur",
    noResult: "Aucun fournisseur ne correspond.",
    empty: "Recherchez par nom de fournisseur ci-dessus pour parcourir le fichier canonique. Chaque fournisseur regroupe toutes les orthographes utilisées par les données sources.",
    spend: "Dépenses totales",
    awards: "contrats",
    years: "Années d'activité",
    variants: "variantes de nom fusionnées",
    topAwards: "Plus grosses attributions",
    categories: "Catégories",
    kinds: { competitive: "Concurrentiel", "non-competitive": "Non concurrentiel", consulting: "Consultation" },
    back: "Retour aux résultats",
    vendorId: "ID fournisseur",
  },
  showcase: {
    kicker: "Vitrine",
    title: "Où vont 21,5 G$.",
    body: "Les 10 premiers fournisseurs ont capté 20,8 % de tout ce que la ville a attribué. La construction domine : 13,0 G$ sur 21,5 G$, menée par des entrepreneurs en voirie et en égouts dont les noms apparaissent des dizaines de fois sous des orthographes légèrement différentes. Les fichiers bruts énumèrent des fournisseurs; ils ne peuvent pas dire qui la ville paie encore et encore. La résolution d'entités le peut.",
    topTitle: "Les 15 premiers fournisseurs par attributions totales",
    topSub: "Fournisseurs canoniques, 2012-2026. Les 109 contrats de Sanscon étaient classés sous des variantes « Limited » et « Ltd. » avant fusion.",
    spend: "dépenses",
    splitTitle: "Concurrentiel contre non concurrentiel",
    splitBody: "90,1 % des dépenses sont passées par la concurrence ouverte (19,4 G$). Les attributions non concurrentielles représentent 8,5 % (1,8 G$ sur 2 887 contrats). Les urgences mènent les motifs non concurrentiels avec 450 M$, suivies des droits exclusifs avec 417 M$.",
    competitive: "Concurrentiel",
    noncompetitive: "Non concurrentiel",
    consulting: "Consultation",
    reasonTitle: "Pourquoi des contrats échappent à la concurrence",
    reasonSub: "Attributions non concurrentielles par motif invoqué, 2013-2026.",
    yearTitle: "Dépenses par année",
    yearSub: "Montants d'attribution tels que publiés, 2012-2026. Les contrats pluriannuels apparaissent en entier l'année d'attribution.",
    catTitle: "Dépenses par catégorie",
    catSub: "La codification grossière de Toronto elle-même; la source ne publie aucun code de produit.",
    repeatTitle: "Les habitués",
    repeatBody: "72 fournisseurs ont remporté au moins 21 contrats chacun. 2 268 fournisseurs n'en ont remporté qu'un seul. La ville réembauche : les affaires répétées sont la norme, pas l'exception.",
    bucketLabels: ["1 contrat", "2-5 contrats", "6-20 contrats", "21+ contrats"],
    vendors: "fournisseurs",
    awardsLabel: "contrats",
  },
  methodology: {
    kicker: "Méthodologie",
    title: "Comment le fichier des fournisseurs a été construit, et où il est faible.",
    items: [
      "Sources : trois lots de données ouvertes de la Ville de Toronto récupérés le 2026-10-08 depuis le magasin CKAN : contrats attribués (7 755 dossiers), contrats non concurrentiels (2 937) et dépenses de consultation 2012-2024 (3 187 lignes sur quatre classeurs). 13 084 dossiers au total.",
      "La résolution d'entités est déterministe et documentée : les noms sont mis en majuscules, la ponctuation retirée, les suffixes juridiques (Ltd, Inc, Corp et 12 autres) supprimés, puis appariés à l'identique; une passe floue fusionne les clés dont le ratio difflib atteint 0,93 ou plus avec un premier mot commun. 4 240 orthographes brutes sont devenues 4 082 fournisseurs canoniques; les 174 fusions sont consignées dans vendor_merges.json.",
      "Trois dossiers portaient des entiers bruts de 10 chiffres dans le champ du montant (9054510208, 4163927134, 1898820680) : le motif de numéros de téléphone, pas d'attributions crédibles. Ils sont en quarantaine et exclus de tous les totaux; sans cela, les dépenses affichées seraient surévaluées de 15,1 G$.",
      "Les montants sont des valeurs d'attribution ou de dépense telles que publiées, pas des paiements finaux audités. Les contrats pluriannuels apparaissent en entier l'année d'attribution : les totaux annuels indiquent le moment de l'engagement, pas les flux de trésorerie.",
      "Toronto ne publie aucun code de produit sur les dossiers d'attribution. La catégorie de haut niveau est la codification grossière de la source elle-même. Les suggestions SCIAN sont des heuristiques par mots-clés contre la table fédérale avec 1,8 % de couverture; ce sont des suggestions, jamais des classifications.",
      "Les anciens affichages de wx.toronto.ca étaient injoignables au moment de la construction; les vidages du magasin CKAN sont donc la source complète utilisée. Les fichiers de planification (pipelines) décrivent des travaux prévus, pas des dépenses, et sont exclus de tous les totaux.",
      "L'identité des fournisseurs n'a aucune clé de numéro d'entreprise dans les données sources : les fusions reposent sur les noms et restent prudentes. La table des variantes est la clé de jointure stable; les ID fournisseurs sont régénérés à chaque reconstruction.",
    ],
  },
  developers: {
    kicker: "Pour les développeurs",
    title: "Interrogez-la depuis du code, ou depuis un agent.",
    body: "Trois façons de consommer les mêmes données canoniques. REST pour les applications, OpenAPI pour l'intégration, outils MCP en HTTP continu pour les agents IA.",
    endpoints: "Points de terminaison",
    tryIt: "Essayer",
    openapi: "Spécification OpenAPI",
    mcpTitle: "Serveur MCP",
    mcpBody: "Un point de terminaison HTTP continu. Outils : vendor_lookup, vendor_search, spend_summary.",
  },
  mcp: {
    kicker: "Connectez votre agent",
    title: "Exploitez ces données dans vos outils d'IA.",
    body: "Choisissez votre plateforme, copiez l'invite, envoyez-la à votre agent. Votre agent exécute la configuration lui-même.",
    tabs: { chatgpt: "ChatGPT", claude: "Claude", claudecode: "Claude Code", cli: "CLI", other: "Autre" },
    cardTitle: "Copiez et envoyez ceci à {tab}",
    copy: "Copier",
    copied: "Copié",
    chatgptNote: "ChatGPT se connecte via l'API REST documentée plutôt que directement en MCP.",
    pChatgpt:
      "Je veux utiliser {displayName} via son API.\n- Spécification OpenAPI : {origin}/api/openapi.json\n- Base REST : {origin}/api/v1\nD'abord, dis-moi en deux phrases ce que cette API offre, puis {exampleLower}, et montre-moi le résultat.",
    pClaude:
      "Dans Claude (claude.ai), ouvre les paramètres, puis Connecteurs, et ajoute un connecteur personnalisé :\n- Nom : {displayName}\n- URL : {origin}/mcp\nEnsuite, liste les outils disponibles, {exampleLower}, et montre-moi le résultat.",
    pClaudeCode:
      "Configure le serveur MCP {displayName} pour que je puisse l'interroger d'ici.\n1. Exécute : claude mcp add --transport http {slug} {origin}/mcp\n2. Exécute `claude mcp list` pour confirmer la connexion.\n3. {example}, et montre-moi le résultat.",
    pCli:
      "# Point de terminaison MCP (HTTP continu)\n{origin}/mcp\n\n# Lister les outils disponibles\ncurl -s -X POST {origin}/mcp -H 'Content-Type: application/json' \\\n  -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}'",
    otherTitle: "Tout le reste",
    otherBody: "Toute plateforme qui parle MCP en HTTP continu, ou REST tout court.",
    mcpEndpoint: "Point de terminaison MCP",
    openapiSpec: "Spécification OpenAPI",
    restBase: "Base REST",
  },
  downloads: {
    kicker: "Données",
    title: "Prenez les fichiers.",
    body: "La table de résolution d'entités et le résumé complet des agrégats, sous licence MIT, en CSV et JSON.",
    files: [
      { name: "vendor_variants.csv", desc: "4 240 orthographes brutes de fournisseurs reliées à 4 082 ID canoniques" },
      { name: "summary.json", desc: "Agrégats de dépenses par année, type, catégorie, division et motif" },
    ],
    download: "Télécharger",
  },
  footer: {
    line: "Un projet civique à code source ouvert. Sans affiliation avec le gouvernement du Canada ni la Ville de Toronto.",
    sources: "Source des attributions : Données ouvertes de la Ville de Toronto (CKAN) : contrats attribués, contrats non concurrentiels, dépenses de consultation. Référence des produits : table fédérale GSIN via toronto-civic-codebooks.",
  },
};

const dicts: Record<Lang, Dict> = { en, fr };

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({
  lang: "en",
  setLang: () => {},
  t: en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t: dicts[lang] }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
