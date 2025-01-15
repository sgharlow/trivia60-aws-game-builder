@echo off
REM Leaderboard API
cd apis/leaderboard
rmdir /s /q node_modules
rmdir /s /q dist
rmdir /s /q .aws-sam
del /f /q *.zip

call npm install --production
call  sam build
call  sam deploy --stack-name trivia-leaderboard-v2 --s3-bucket trivia60-sam-artifacts --parameter-overrides Stage=uat PGHost=trivia-uat-infrastructure-rdsinstance-bk57cekrzk70.cnhyw40jxh6a.us-east-1.rds.amazonaws.com PGUser=reddit PGPassword=TriviaPass123 PGDatabase=trivia_db PGPort=5432 --capabilities CAPABILITY_IAM --no-confirm-changeset