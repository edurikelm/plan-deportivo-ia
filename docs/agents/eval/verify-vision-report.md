# Vision Verification Report

Generated at: 2026-08-04T23:00:00.500Z

Model: `MiniMax-M3`
Image source: baseline-svg

## Result

| Field | Value |
|-------|-------|
| Latency | 5372ms |
| Tokens | 636 |
| JSON valid | yes |
| Zod valid | yes |
| Cross-check | match |
| Verdict | **OK** |

> totals match (Δkg=0.0000, Δlb=0.0000)

## Parsed breakdown

```json
{
  "barKg": 20,
  "discs": [
    {
      "weight": 25,
      "unit": "kg",
      "count": 1
    },
    {
      "weight": 10,
      "unit": "kg",
      "count": 1
    },
    {
      "weight": 5,
      "unit": "kg",
      "count": 1
    }
  ],
  "totalKg": 100,
  "totalLb": 220.462
}
```

## Raw response (first 200 chars)

```
{"barKg":20,"discs":[{"weight":25,"unit":"kg","count":1},{"weight":10,"unit":"kg","count":1},{"weight":5,"unit":"kg","count":1}],"totalKg":100,"totalLb":220.462,"uncertain":true}
```