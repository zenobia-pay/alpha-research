# Econ Read-Only Volume Capacity Audit

- Execution id: `48c10143-333c-4aae-aa40-9f1dbcfd03b4`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/48c10143-333c-4aae-aa40-9f1dbcfd03b4`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/48c10143-333c-4aae-aa40-9f1dbcfd03b4/artifacts`
- Status: `ready`

## Result

The read-only audit found that the econ dataset volume has ample byte capacity but is effectively out of inodes:

- `df -h /data/datasets/econ`: 382G available on `/__modal/volumes`.
- `df -i /data/datasets/econ`: 500,000 inodes, 499,998 used, 2 free, 100% inode usage.
- `du -sh /data/datasets/econ`: 27G.

The prior ENOSPC failures are therefore consistent with inode exhaustion, not byte exhaustion.

## Largest Present Packages

The largest top-level raw source directories reported by the audit were:

- `raw/hud_lai`: 1.3G.
- `raw/census_bds`: 1.2G.
- `raw/census`: 949M.
- `raw/wiod`: 877M.
- `raw/worldbank`: 268M.

Large files over 500M at depth <= 3 included:

- `/data/datasets/econ/raw/hud_lai/Location_Affordability_Index_v.3.dbf`
- `/data/datasets/econ/raw/wiod/WIOTS_in_EXCEL.zip`
- `/data/datasets/econ/intermediate/acs_pums_2024/psam_pusb.csv`
- `/data/datasets/econ/raw/census_bds/BDSTIMESERIES.zip`
- `/data/datasets/econ/intermediate/acs_pums_2024/psam_pusa.csv`

## Recommended Next Action

Increase the dataset volume inode quota, or compact/remove abandoned temporary file trees after a separate cleanup audit, before resuming canonical writes. Until then, use read-only/profile-only finalization for sources already present on the mounted volume and avoid new provider downloads.
