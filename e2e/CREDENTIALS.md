# Local Windows Credential Manager

`scripts\VctHealthTest.ps1` stores each region's Playwright login as a generic
credential in the current Windows user's Credential Manager. Password entry is
hidden, and credentials are not written to `.env` or the repository.

From the `e2e` directory, save credentials for a region:

```powershell
.\scripts\VctHealthTest.ps1 -Action Store -Region CHINA
```

Regions: `US`, `EU`, `ASIA`, `LATAM`, and `CHINA`. The script asks for the
username and password interactively. To replace a saved credential, run the
same command again for that region. Credentials can also be removed through
Windows Credential Manager by deleting the generic credential named
`VCT.Playwright.<REGION>`.
Existing entries named `VCT Production <Region> - <portal URL>` are also read
when a `VCT.Playwright.<REGION>` entry is absent.

Run the production health checks for a region:

```powershell
.\scripts\VctHealthTest.ps1 -Action Run -Region CHINA
```

The script asks for confirmation because the email tests send messages.
The biometric check is skipped on China, LATAM, and confirmed QA US hosts
because biometric service is not deployed there. `npm ci` must have been
run in `e2e` before starting the health test.

The health suite also clicks `Check services health` and checks all five service
rows. Services must report `Healthy`. `Not configured` is accepted only for
Biometric Matcher on the confirmed LATAM, China, and QA US hosts, where
biometrics is not deployed. For other services it fails the test, as do
`Unavailable`, `Unhealthy`, and unexpected statuses. Each service is reported
separately, and service results are attached as JSON
to the Playwright report. A full-page result screenshot is saved and attached
after every health check, whether it passes or fails.
The email checks click their buttons and require `Emails were sent` and
`Email was sent`, respectively; they do not verify inbox delivery or attachments.
