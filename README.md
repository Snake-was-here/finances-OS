# Finansų OS

Ryškus, paprastas tavo uždarbio, išlaidų ir tikslų progreso puslapis.

## Paleidimas

```bash
npm install
npm run dev
```

Vercel projekte pridėk šiuos Environment Variables (Production, Preview ir Development):

- `FINANCES_PASSWORD` — tavo prisijungimo slaptažodis
- `FINANCES_AUTH_SECRET` — ilga atsitiktinė paslaptis sesijos slapukui

`.env.example` rodo formatą, o vietiniam paleidimui jau yra atskiras, į Git neįtraukiamas `.env.local`. Duomenys saugomi naršyklėje, todėl prieš keičiant įrenginį ar valant naršyklės duomenis naudok **Eksportuoti duomenis**.

Slaptažodis laikomas tik Vercel aplinkos kintamajame, o prisijungimas palieka pasirašytą HTTP-only sesijos slapuką. Tai apsaugo puslapio sąsają; finansinių įrašų sinchronizacijai tarp įrenginių vėliau reikės duomenų bazės.
