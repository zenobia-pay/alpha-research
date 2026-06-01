# FAOSTAT Agriculture And Food Systems Ingestion Summary

- Execution id: `7f2540ad-435e-4f9d-b83e-722f168f5b4f`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/7f2540ad-435e-4f9d-b83e-722f168f5b4f`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/7f2540ad-435e-4f9d-b83e-722f168f5b4f/artifacts`
- Final execution status: `ready`
- Validation status: `blocked`

## What Landed

The worker passed disk/inode checks and a write/delete probe, then added official FAOSTAT bulk packages under `raw/faostat/`:

- `raw/faostat/Production_Crops_Livestock_E_All_Data_Normalized.zip`
- `raw/faostat/FoodBalanceSheets_E_All_Data_Normalized.zip`

The artifact stream reports:

- Production package: about 32.4 MB, 4,209,110 country-commodity rows, 244 areas, 1961-2024.
- Food balance package: about 52.3 MB, 4,820,497 rows, 213 areas, 2010-2023.
- Coverage: crop and livestock production, yields, harvested area, stocks, livestock outputs, supply utilization, trade balance, feed, population, kcal per capita, protein supply, and related food-system indicators.
- Storage: provider-native ZIP packages retained without extraction to the dataset volume.

## Validation Result

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 7f2540ad-435e-4f9d-b83e-722f168f5b4f` blocked even though the execution reached `ready` and promoted the four primary artifacts. Blockers:

- `dataset_briefing.md` artifact omitted existing required marker `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`.
- Backend profile readback still pointed to prior run `4822354c-5587-421f-b0e6-b8616d6c6e99`.

The worker log says backend profile POST/GET attempts failed due DNS resolution for `alpha.us-east-1.remote.workflows.openai.com`. Checked-in public docs were updated with the FAOSTAT bullet, but the canonical backend profile was not treated as validated from this run.

## Follow-Up

Run a profile-sync repair job that promotes the full checked-in briefing, preserves all required inventory markers, and updates backend profile proof to the repair execution id. Continue adding compact official source families from the roadmap after profile sync is reliable.
