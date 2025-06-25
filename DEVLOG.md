### Loan Service
Loan service applyForLoan and updateLoan, takes assetId as a nullable parameter. We need to check if that assetId exists in our inventory to continue

interestPerAnnum should be fetched from a singleStore database containing app-wide information to consume!