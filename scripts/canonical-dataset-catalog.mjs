export const CANONICAL_DATASETS = [
  {
    id: "econ",
    name: "Econ",
    fieldBrief: "Economics: macroeconomics, labor, housing, inflation, credit, consumer behavior, regional economics, and business-cycle research.",
    seedCandidates: [
      "- Eurostat bulk download / SDMX API: https://ec.europa.eu/eurostat/ (active_fetchable)",
      "- European Central Bank SDW API: https://data.ecb.europa.eu/ (active_fetchable)",
      "- BIS statistics (SDMX): https://www.bis.org/statistics/ (active_fetchable)",
      "- World Bank WDI API: https://data.worldbank.org/ (active_fetchable)",
      "- OECD API / bulk downloads: https://data-explorer.oecd.org/ (active_fetchable)",
      "- OpenCorporates company registry: https://opencorporates.com/ (license_review)",
    ],
  },
  {
    id: "history",
    name: "History",
    fieldBrief: "History: public archival records, newspapers, government documents, maps, manuscripts, oral histories, gazetteers, and historical metadata for social, political, cultural, and economic history.",
    seedCandidates: [
      "- Library of Congress digital collections: https://www.loc.gov/collections/ (active_fetchable)",
      "- National Archives catalog: https://catalog.archives.gov/ (active_fetchable)",
      "- Chronicling America newspapers: https://chroniclingamerica.loc.gov/ (active_fetchable)",
      "- HathiTrust bibliographic and public-domain metadata: https://www.hathitrust.org/ (license_review)",
      "- Europeana API and datasets: https://pro.europeana.eu/page/apis (active_fetchable)",
      "- Digital Public Library of America API: https://pro.dp.la/developers/api-codex (active_fetchable)",
      "- Wikidata dumps: https://www.wikidata.org/wiki/Wikidata:Database_download (active_fetchable)",
      "- Harvard Dataverse history collections: https://dataverse.harvard.edu/ (active_fetchable)",
    ],
  },
  {
    id: "literature",
    name: "Literature",
    fieldBrief: "Literature: public-domain texts, bibliographic metadata, editions, authorship records, genre metadata, translations, and text corpora for literary research.",
    seedCandidates: [
      "- Project Gutenberg catalog and texts: https://www.gutenberg.org/ (active_fetchable)",
      "- Internet Archive text collections: https://archive.org/details/texts (active_fetchable)",
      "- HathiTrust metadata and public-domain records: https://www.hathitrust.org/ (license_review)",
      "- Open Library data dumps: https://openlibrary.org/developers/dumps (active_fetchable)",
      "- Wikisource dumps: https://dumps.wikimedia.org/ (active_fetchable)",
      "- Perseus Digital Library texts: https://www.perseus.tufts.edu/ (license_review)",
    ],
  },
  {
    id: "philosophy",
    name: "Philosophy",
    fieldBrief: "Philosophy: public-domain philosophical texts, encyclopedia/reference metadata, bibliographies, author/work metadata, and open teaching or citation corpora where licensing permits.",
    seedCandidates: [
      "- PhilPapers metadata: https://philpapers.org/ (license_review)",
      "- Stanford Encyclopedia of Philosophy pages and metadata: https://plato.stanford.edu/ (license_review)",
      "- Internet Archive philosophy collections: https://archive.org/ (active_fetchable)",
      "- Project Gutenberg philosophy texts: https://www.gutenberg.org/ (active_fetchable)",
      "- Wikisource philosophy texts: https://dumps.wikimedia.org/ (active_fetchable)",
      "- Open Syllabus public references: https://opensyllabus.org/ (license_review)",
    ],
  },
  {
    id: "religion",
    name: "Religion",
    fieldBrief: "Religion: public religious texts, translations, commentaries, liturgical materials, religious studies metadata, textual corpora, and historical religious-source collections.",
    seedCandidates: [
      "- Internet Sacred Text Archive: https://sacred-texts.com/ (license_review)",
      "- Sefaria public data/API: https://www.sefaria.org/developers (active_fetchable)",
      "- Quran corpus and public translations: https://corpus.quran.com/ (license_review)",
      "- Perseus religious and classical texts: https://www.perseus.tufts.edu/ (license_review)",
      "- Internet Archive religion collections: https://archive.org/ (active_fetchable)",
      "- Wikisource religious texts: https://dumps.wikimedia.org/ (active_fetchable)",
    ],
  },
  {
    id: "classics",
    name: "Classics",
    fieldBrief: "Classics: Greek and Latin texts, inscriptions, papyri, prosopography, ancient places, classical reception metadata, and archaeological/historical source catalogs.",
    seedCandidates: [
      "- Perseus Digital Library: https://www.perseus.tufts.edu/ (license_review)",
      "- Packard Humanities Institute classical resources: https://latin.packhum.org/ (license_review)",
      "- Pleiades ancient places: https://pleiades.stoa.org/ (active_fetchable)",
      "- Trismegistos metadata: https://www.trismegistos.org/ (license_review)",
      "- Open Greek and Latin: https://opengreekandlatin.org/ (active_fetchable)",
      "- Epigraphic Database Heidelberg: https://edh.ub.uni-heidelberg.de/ (license_review)",
    ],
  },
  {
    id: "art-history",
    name: "Art History",
    fieldBrief: "Art history: museum open collections, artwork/object metadata, artist authority files, image metadata, provenance records, vocabularies, and cultural-heritage aggregation sources.",
    seedCandidates: [
      "- Wikimedia Commons structured data dumps: https://commons.wikimedia.org/wiki/Commons:Database_download (active_fetchable)",
      "- Getty vocabularies: https://www.getty.edu/research/tools/vocabularies/ (active_fetchable)",
      "- Metropolitan Museum of Art Open Access: https://metmuseum.github.io/ (active_fetchable)",
      "- Rijksmuseum API: https://data.rijksmuseum.nl/object-metadata/api/ (active_fetchable)",
      "- Art Institute of Chicago API: https://api.artic.edu/docs/ (active_fetchable)",
      "- Europeana API and datasets: https://pro.europeana.eu/page/apis (active_fetchable)",
    ],
  },
  {
    id: "musicology",
    name: "Musicology",
    fieldBrief: "Musicology: music bibliographic metadata, works and recordings, public-domain scores, performance metadata, authority records, audio collections, and music-history source catalogs.",
    seedCandidates: [
      "- MusicBrainz database dumps: https://musicbrainz.org/doc/MusicBrainz_Database/Download (active_fetchable)",
      "- IMSLP metadata and public-domain scores: https://imslp.org/ (license_review)",
      "- Internet Archive audio and music metadata: https://archive.org/details/audio (active_fetchable)",
      "- Library of Congress music collections: https://www.loc.gov/collections/?fa=partof:music+division (active_fetchable)",
      "- Wikidata music entities: https://www.wikidata.org/wiki/Wikidata:Database_download (active_fetchable)",
      "- Choral Public Domain Library: https://www.cpdl.org/ (license_review)",
    ],
  },
  {
    id: "theater-performance",
    name: "Theater & Performance",
    fieldBrief: "Theater and performance studies: plays, productions, venues, performers, performance metadata, public-domain scripts, reviews, and theater-history source collections.",
    seedCandidates: [
      "- Internet Broadway Database metadata: https://www.ibdb.com/ (license_review)",
      "- Playbill production metadata: https://playbill.com/ (license_review)",
      "- Folger Shakespeare public resources: https://www.folger.edu/explore/shakespeares-works/ (license_review)",
      "- Project Gutenberg plays: https://www.gutenberg.org/ (active_fetchable)",
      "- Wikidata performing arts entities: https://www.wikidata.org/wiki/Wikidata:Database_download (active_fetchable)",
      "- Internet Archive theater collections: https://archive.org/ (active_fetchable)",
    ],
  },
  {
    id: "linguistics",
    name: "Linguistics",
    fieldBrief: "Linguistics: language catalogs, typological databases, phonological inventories, lexical concepts, treebanks, corpora metadata, and interoperable linguistic datasets.",
    seedCandidates: [
      "- CLDF datasets: https://cldf.clld.org/ (active_fetchable)",
      "- World Atlas of Language Structures: https://wals.info/ (active_fetchable)",
      "- Glottolog: https://glottolog.org/ (active_fetchable)",
      "- PHOIBLE: https://phoible.org/ (active_fetchable)",
      "- Concepticon: https://concepticon.clld.org/ (active_fetchable)",
      "- Universal Dependencies: https://universaldependencies.org/ (active_fetchable)",
      "- Leipzig Corpora Collection: https://wortschatz.uni-leipzig.de/en/download/ (license_review)",
    ],
  },
  {
    id: "anthropology",
    name: "Anthropology",
    fieldBrief: "Anthropology: archaeological records, ethnographic metadata, cultural trait datasets, museum collections, place/entity gazetteers, and public anthropology-adjacent research datasets.",
    seedCandidates: [
      "- Open Context archaeology data: https://opencontext.org/ (active_fetchable)",
      "- tDAR metadata and public records: https://www.tdar.org/ (license_review)",
      "- D-PLACE cultural and environmental data: https://d-place.org/ (active_fetchable)",
      "- eHRAF World Cultures metadata (credential/deferred only): https://ehrafworldcultures.yale.edu/ (credential_required)",
      "- Archaeological gazetteers, including Pleiades ancient places: https://pleiades.stoa.org/ (active_fetchable)",
      "- Museum open collections, including Smithsonian Open Access: https://www.si.edu/openaccess (active_fetchable)",
      "- Museum open collections, including Metropolitan Museum of Art Open Access: https://metmuseum.github.io/ (active_fetchable)",
      "- Harvard Dataverse anthropology collections: https://dataverse.harvard.edu/ (active_fetchable)",
    ],
  },
];

export const HUMANITIES_DATASET_IDS = [
  "history",
  "literature",
  "philosophy",
  "religion",
  "classics",
  "art-history",
  "musicology",
  "theater-performance",
  "linguistics",
  "anthropology",
];

export function seedCandidatesText(dataset) {
  return dataset.seedCandidates.join("\n");
}

export function selectCanonicalDatasets(idsText = process.env.CANONICAL_DATASET_IDS) {
  const ids = (idsText ?? CANONICAL_DATASETS.map((dataset) => dataset.id).join(","))
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const byId = new Map(CANONICAL_DATASETS.map((dataset) => [dataset.id, dataset]));
  return ids.map((id) => {
    const dataset = byId.get(id);
    if (!dataset) {
      throw new Error(`Unknown canonical dataset id "${id}". Known ids: ${CANONICAL_DATASETS.map((entry) => entry.id).join(", ")}`);
    }
    return {
      ...dataset,
      seedCandidates: [...dataset.seedCandidates],
    };
  });
}
