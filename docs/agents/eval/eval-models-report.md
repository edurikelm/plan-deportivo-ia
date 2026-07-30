# Model Evaluation Report

Generated at: 2026-07-30T14:51:34.181Z

Inputs: 6 representative CrossFit combinations (varied wodFormat, strengthSkill, optional focus/considerations).
Configurations tested:
1. MiniMax-M2.7-highspeed (markdown, default — no thinking param)
2. MiniMax-M2.7-highspeed (markdown, thinking: disabled)
3. MiniMax-Text-01 (JSON prompt, no response_format)
4. MiniMax-Text-01 (JSON prompt, response_format: json_object)

## Results

| Input | Model | Success | Latency | Tokens | Format | Detail | Preview |
|-------|-------|---------|---------|--------|--------|--------|---------|
| AMRAP + Back Squat | MiniMax-M2.7-highspeed | ✓ | 21592ms | 1364 | ✓ | all 4 headers | <think> El usuario quiere una clase de CrossFit con: - Duración total: 60 minuto |
| AMRAP + Back Squat | M2.7-highspeed+thinking:off | ✓ | 17625ms | 1099 | ✓ | all 4 headers | <think> Necesito crear una sesión de CrossFit completa con los parámetros dados: |
| AMRAP + Back Squat | MiniMax-Text-01 (no response_format) | ✓ | 12701ms | 748 | ✓ | JSON + Zod valid | {   "class_title": "Potencia y Resistencia: ¡Siente el Poder del Squat!",   "foc |
| AMRAP + Back Squat | MiniMax-Text-01 | ✗ | 200ms | - | — | 400 invalid params, unknown response_format type 'json_objec |  |
| EMOM + Snatch | MiniMax-M2.7-highspeed | ✓ | 34975ms | 4431 | ✗ | missing: # , ## Warm-Up, ## Strength / Skill, ## WOD, ## Coo | <think> Analicemos los parámetros: - Duración: 60 minutos - Strength/Skill: Powe |
| EMOM + Snatch | M2.7-highspeed+thinking:off | ✓ | 23869ms | 1324 | ✓ | all 4 headers | <think> Necesito crear una sesión de CrossFit de 60 minutos con: - Power Snatch  |
| EMOM + Snatch | MiniMax-Text-01 (no response_format) | ✓ | 13113ms | 797 | ✓ | JSON + Zod valid | {   "class_title": "Explosive Power: Mastering the Snatch",   "focus_movement":  |
| EMOM + Snatch | MiniMax-Text-01 | ✗ | 185ms | - | — | 400 invalid params, unknown response_format type 'json_objec |  |
| Aleatorio + Thruster | MiniMax-M2.7-highspeed | ✓ | 28525ms | 1547 | ✓ | all 4 headers | <think> El usuario me pide generar una sesión de CrossFit con los siguientes par |
| Aleatorio + Thruster | M2.7-highspeed+thinking:off | ✓ | 26302ms | 1354 | ✓ | all 4 headers | <think> El usuario quiere una sesión de CrossFit de 60 minutos con: - Thruster 5 |
| Aleatorio + Thruster | MiniMax-Text-01 (no response_format) | ✓ | 13597ms | 830 | ✓ | JSON + Zod valid | {   "class_title": "Thrusters y Fuerza: Construyendo Potencia Funcional",   "foc |
| Aleatorio + Thruster | MiniMax-Text-01 | ✗ | 366ms | - | — | 400 invalid params, unknown response_format type 'json_objec |  |
| Tabata + Muscle-up | MiniMax-M2.7-highspeed | ✓ | 27831ms | 1383 | ✓ | all 4 headers | <think> El usuario me pide generar una sesión de CrossFit con estos parámetros:  |
| Tabata + Muscle-up | M2.7-highspeed+thinking:off | ✓ | 20263ms | 1181 | ✓ | all 4 headers | <think> El usuario solicita una sesión de CrossFit de 45 minutos con: - Warm-Up  |
| Tabata + Muscle-up | MiniMax-Text-01 (no response_format) | ✓ | 9360ms | 791 | ✓ | JSON + Zod valid | {   "class_title": "Dominando los Muscle-ups: Progresión y Potencia",   "focus_m |
| Tabata + Muscle-up | MiniMax-Text-01 | ✗ | 451ms | - | — | 400 invalid params, unknown response_format type 'json_objec |  |
| For Time + Deadlift | MiniMax-M2.7-highspeed | ✓ | 40232ms | 2102 | ✓ | all 4 headers | <think> El usuario me pide generar una sesión de CrossFit con los siguientes par |
| For Time + Deadlift | M2.7-highspeed+thinking:off | ✓ | 35350ms | 1888 | ✓ | all 4 headers | <think> Voy a generar una sesión de CrossFit de 75 minutos con los parámetros da |
| For Time + Deadlift | MiniMax-Text-01 (no response_format) | ✓ | 14183ms | 837 | ✓ | JSON + Zod valid | {   "class_title": "Deadlift Dominance: Fuerza y Resistencia",   "focus_movement |
| For Time + Deadlift | MiniMax-Text-01 | ✗ | 182ms | - | — | 400 invalid params, unknown response_format type 'json_objec |  |
| Intervalos + Handstand | MiniMax-M2.7-highspeed | ✓ | 31761ms | 1683 | ✓ | all 4 headers | <think> Analicemos los parámetros:  1. Duración: 90 minutos 2. Strength/Skill: H |
| Intervalos + Handstand | M2.7-highspeed+thinking:off | ✓ | 18572ms | 1257 | ✓ | all 4 headers | <think> The user wants a CrossFit class focused on handstand work with the follo |
| Intervalos + Handstand | MiniMax-Text-01 (no response_format) | ✓ | 15683ms | 795 | ✓ | JSON + Zod valid | {   "class_title": "Desafiando la Gravedad: Dominando el Handstand",   "focus_mo |
| Intervalos + Handstand | MiniMax-Text-01 | ✗ | 448ms | - | — | 400 invalid params, unknown response_format type 'json_objec |  |

## Summary

| Model | Success | Format-valid | Avg Latency |
|-------|---------|--------------|-------------|
| MiniMax-M2.7-highspeed | 6/6 | 5/6 | 30819ms |
| M2.7-highspeed+thinking:off | 6/6 | 6/6 | 23664ms |
| MiniMax-Text-01 (no response_format) | 6/6 | 6/6 | 13106ms |
| MiniMax-Text-01 (response_format) | 0/6 | 0/6 | 305ms |

## Verdict

✅ ADOPT MiniMax-Text-01 (no response_format). 100% JSON valid, 57% latency reduction (13106ms vs 30819ms). Re-introduce structured output.