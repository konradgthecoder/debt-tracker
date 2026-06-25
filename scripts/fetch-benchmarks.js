#!/usr/bin/env node
/**
 * fetch-benchmarks.js — refresh benchmarks.json from durable, free, keyless sources.
 *
 * Primary source: Eurostat national accounts, household final consumption
 * expenditure by COICOP purpose (dataset `nama_10_co3_p3`), current prices,
 * million EUR, geo=PL, latest available year. Divided by Poland's population
 * (Eurostat `demo_pjan`) and converted EUR→PLN to give per-person monthly PLN.
 *
 * This is run by .github/workflows/benchmarks.yml (yearly + manual dispatch),
 * which commits the updated benchmarks.json. The data changes slowly, so a
 * baked snapshot keeps the app fast, offline-safe, and consistent.
 *
 * If a source's shape changes, the script logs and exits non-zero WITHOUT
 * overwriting the existing benchmarks.json, so a bad fetch can't wipe good data.
 *
 * Run locally:  node scripts/fetch-benchmarks.js
 * Node 18+ (global fetch).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'benchmarks.json');
const EUR_PLN = Number(process.env.EUR_PLN || 4.3); // refreshed automatically below if NBP reachable

// COICOP divisions we care about → friendly labels (matched fuzzily by the AI)
const COICOP = [
  { code: 'CP01',  label: 'Food & groceries (at home)' },
  { code: 'CP02',  label: 'Alcohol & tobacco' },
  { code: 'CP03',  label: 'Clothing & footwear' },
  { code: 'CP04',  label: 'Housing, utilities, water, energy' },
  { code: 'CP05',  label: 'Furnishings & household goods' },
  { code: 'CP06',  label: 'Health, medical & pharmacy' },
  { code: 'CP07',  label: 'Transport (incl. fuel)' },
  { code: 'CP08',  label: 'Communication (phone & internet)' },
  { code: 'CP09',  label: 'Recreation & culture' },
  { code: 'CP10',  label: 'Education' },
  { code: 'CP11',  label: 'Restaurants, dining out & bars' },
  { code: 'CP12',  label: 'Other goods & services' },
];

const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

const UA = 'Mozilla/5.0 (compatible; debt-tracker-benchmarks/1.0; +https://github.com/konradgthecoder/debt-tracker)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': UA } });
      const text = await res.text();
      if (res.ok) {
        try { return JSON.parse(text); }
        catch { throw new Error(`non-JSON (ct=${res.headers.get('content-type')}) :: ${text.replace(/\s+/g,' ').slice(0,300)}`); }
      }
      last = new Error(`HTTP ${res.status} :: ${text.replace(/\s+/g,' ').slice(0,200)}`);
      // 5xx / "temporarily unavailable" → retry with backoff
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) { last = e; }
    if (i < tries - 1) { console.warn(`  retry ${i + 1}/${tries - 1} after error: ${last.message.slice(0,120)}`); await sleep(3000 * (i + 1)); }
  }
  throw new Error(`${url} :: ${last && last.message}`);
}

// pull the latest non-null value for each COICOP from a JSON-stat response
function latestByCoicop(jsonstat) {
  const dim = jsonstat.dimension;
  const coicopIdx = dim.coicop.category.index;     // {CP01:0,...}
  const timeIdx = dim.time.category.index;          // {2019:0, 2020:1,...}
  const times = Object.keys(timeIdx).sort();        // ascending
  const sizes = jsonstat.size;                      // dimension sizes in id order
  const ids = jsonstat.id;                          // dimension order
  const values = jsonstat.value;                    // flat map index->value

  // build strides for flat-index computation
  const strides = ids.map((_, i) => sizes.slice(i + 1).reduce((a, b) => a * b, 1));

  const out = {};
  for (const { code } of COICOP) {
    if (!(code in coicopIdx)) continue;
    // find latest year with a value
    for (let t = times.length - 1; t >= 0; t--) {
      const idxParts = ids.map(id => {
        if (id === 'coicop') return coicopIdx[code];
        if (id === 'time') return timeIdx[times[t]];
        return 0; // first category for every other dimension (geo=PL, unit, etc. constrained in query)
      });
      const flat = idxParts.reduce((acc, p, i) => acc + p * strides[i], 0);
      const v = values[flat];
      if (v != null) { out[code] = { value: v, year: times[t] }; break; }
    }
  }
  return out;
}

async function fetchEurPln() {
  try {
    const d = await getJSON('https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json');
    const r = d?.rates?.[0]?.mid;
    if (r) return r;
  } catch (e) { console.warn('EUR/PLN fetch failed, using fallback', EUR_PLN); }
  return EUR_PLN;
}

async function fetchPopulation() {
  // Eurostat demo_pjan, total population PL, recent years (filtered to keep query small)
  const url = `${EUROSTAT}/demo_pjan?format=JSON&lang=en&freq=A&unit=NR&sex=T&age=TOTAL&geo=PL&sinceTimePeriod=2019`;
  const js = await getJSON(url);
  const timeIdx = js.dimension.time.category.index;
  const times = Object.keys(timeIdx).sort();
  const ids = js.id, sizes = js.size;
  const strides = ids.map((_, i) => sizes.slice(i + 1).reduce((a, b) => a * b, 1));
  for (let t = times.length - 1; t >= 0; t--) {
    const flat = ids.reduce((acc, id, i) => acc + (id === 'time' ? timeIdx[times[t]] : 0) * strides[i], 0);
    const v = js.value[flat];
    if (v != null) return { pop: v, year: times[t] };
  }
  throw new Error('no population value found');
}

async function main() {
  console.log('Fetching EUR/PLN…');
  const eurPln = await fetchEurPln();
  console.log('  EUR/PLN =', eurPln);

  console.log('Fetching Poland population (Eurostat demo_pjan)…');
  const { pop, year: popYear } = await fetchPopulation();
  console.log('  population =', pop, '(', popYear, ')');

  console.log('Fetching household consumption by COICOP (Eurostat nama_10_co3_p3)…');
  // current prices, million EUR, domestic concept (P31_S14)
  const url = `${EUROSTAT}/nama_10_co3_p3?format=JSON&lang=en&freq=A&unit=CP_MEUR&na_item=P31_S14&geo=PL&sinceTimePeriod=2018`;
  const js = await getJSON(url);
  const byCoicop = latestByCoicop(js);
  if (Object.keys(byCoicop).length < 6) throw new Error('too few COICOP values parsed — aborting to protect existing data');

  const categories = COICOP.map(({ code, label }) => {
    const hit = byCoicop[code];
    if (!hit) return null;
    // million EUR/year → EUR/year → PLN/year → per person → per month
    const plnPerPersonMonth = (hit.value * 1e6 * eurPln) / pop / 12;
    return { label, coicop: code, monthlyPLN: Math.round(plnPerPersonMonth), dataYear: hit.year };
  }).filter(Boolean);

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    country: 'PL',
    basis: 'per person, per month, PLN',
    note: "National per-capita averages from Poland's household final consumption by COICOP (Eurostat), ÷ population, EUR→PLN at NBP rate. Warsaw runs ~20-30% higher and a single late-20s person skews toward dining/transport/recreation — adjust. Baseline, not a target.",
    sources: [
      `Eurostat nama_10_co3_p3 (household final consumption by COICOP, PL, ${categories[0]?.dataYear || 'latest'})`,
      `Eurostat demo_pjan population (${popYear})`,
      'NBP EUR/PLN reference rate',
    ],
    eurPln,
    population: pop,
    approxSeed: false,
    categories,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${OUT} with ${categories.length} categories.`);
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
