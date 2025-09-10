# Detailed AWS S3 Bucket and IAM Setup Instructions

This guide provides step-by-step instructions for setting up AWS S3 and IAM for your Angular app deployment.

## Part 1: Create S3 Bucket

### Step 1: Access S3 Console
1. Log into the [AWS Management Console](https://aws.amazon.com/console/)
2. In the search bar at the top, type "S3" and click on "S3"
3. You'll see the S3 dashboard

### Step 2: Create New Bucket
1. Click the **"Create bucket"** button (orange button on the right)
2. Fill in the bucket configuration:

#### General Configuration:
- **Bucket name**: `duo-mapping-client-app` (or any unique name)
  - ⚠️ Must be globally unique across all AWS accounts
  - ⚠️ Use lowercase letters, numbers, and hyphens only
  - ⚠️ No spaces or special characters

- **AWS Region**: Choose your preferred region
  - `US East (N. Virginia) us-east-1` is recommended for best performance
  - Note: Update the region in your GitHub workflow if you choose a different one

#### Object Ownership:
- Leave as **"ACLs disabled (recommended)"**

#### Block Public Access settings:
- **IMPORTANT**: Uncheck **"Block all public access"**
- A warning will appear - this is expected for a public website
- Check the box that says **"I acknowledge that the current settings might result in this bucket and the objects within becoming public"**

#### Bucket Versioning:
- Leave as **"Disable"** (default)

#### Tags:
- Optional: Add tags like:
  - Key: `Project`, Value: `duo-mapping-client`
  - Key: `Environment`, Value: `production`

#### Default encryption:
- Leave as default settings

3. Click **"Create bucket"**

### Step 3: Configure Static Website Hosting
1. Click on your newly created bucket name to open it
2. Click on the **"Properties"** tab
3. Scroll down to find **"Static website hosting"**
4. Click **"Edit"**
5. Configure as follows:
   - **Static website hosting**: Select **"Enable"**
   - **Hosting type**: Select **"Host a static website"**
   - **Index document**: Enter `index.html`
   - **Error document**: Enter `index.html` (this enables Angular routing)
6. Click **"Save changes"**
7. **Note the endpoint URL** shown - this is where your app will be accessible

### Step 4: Set Bucket Policy for Public Access
1. Still in your bucket, click on the **"Permissions"** tab
2. Scroll down to **"Bucket policy"**
3. Click **"Edit"**
4. Copy and paste the following policy (replace `YOUR_BUCKET_NAME` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::duo-mapping-client-app/*"
    }
  ]
}
```

5. Click **"Save changes"**

## Part 2: Create IAM User for GitHub Actions

### Step 1: Access IAM Console
1. In the AWS Console search bar, type "IAM" and click on "IAM"
2. You'll see the IAM dashboard

### Step 2: Create New User
1. In the left sidebar, click **"Users"**
2. Click **"Create user"** (blue button)
3. Configure the user:

#### Step 1 - Specify user details:
- **User name**: `github-actions-s3-deploy`
- **Provide user access to the AWS Management Console**: Leave **UNCHECKED**
  - We only need programmatic access, not console access
4. Click **"Next"**

#### Step 2 - Set permissions:
1. Select **"Attach policies directly"**
2. Click **"Create policy"** (this opens a new tab)

### Step 3: Create Custom Policy
In the new tab that opened:

1. Click on the **"JSON"** tab
2. Replace the default policy with this custom policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3BucketAccess",
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::duo-mapping-client-app"
        },
        {
            "Sid": "S3ObjectAccess",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::duo-mapping-client-app/*"
        },
        {
            "Sid": "CloudFrontInvalidation",
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation"
            ],
            "Resource": "*"
        }
    ]
}
```

3. Replace `duo-mapping-client-app` with your actual bucket name in both places
4. Click **"Next"**
5. Enter policy details:
   - **Policy name**: `GitHubActionsS3DeployPolicy`
   - **Description**: `Allows GitHub Actions to deploy to S3 bucket and invalidate CloudFront`
6. Click **"Create policy"**

### Step 4: Attach Policy to User
1. Go back to the user creation tab
2. Click the refresh button next to "Create policy"
3. In the search box, type: `GitHubActionsS3DeployPolicy`
4. Check the box next to your policy
5. Click **"Next"**
6. Review the user details and click **"Create user"**

### Step 5: Generate Access Keys
1. Click on the user you just created (`github-actions-s3-deploy`)
2. Click on the **"Security credentials"** tab
3. Scroll down to **"Access keys"**
4. Click **"Create access key"**
5. Select **"Application running outside AWS"**
6. Click **"Next"**
7. Optional: Add a description like "GitHub Actions deployment"
8. Click **"Create access key"**
9. **IMPORTANT**: Copy both values:
   - **Access key ID**: (starts with AKIA...)
   - **Secret access key**: (long random string)
   - ⚠️ **This is the only time you'll see the secret key!**

## Part 3: Configure GitHub Repository Secrets

### Step 1: Access Repository Settings
1. Go to your GitHub repository: `https://github.com/mparsin/duo-mapping-client`
2. Click on **"Settings"** tab (you need to be the repository owner)
3. In the left sidebar, click **"Secrets and variables"** → **"Actions"**

### Step 2: Add Repository Secrets
Click **"New repository secret"** for each of these:

#### Secret 1: AWS_ACCESS_KEY_ID
- **Name**: `AWS_ACCESS_KEY_ID`
- **Secret**: Paste your Access Key ID from Step 5 above
- Click **"Add secret"**

#### Secret 2: AWS_SECRET_ACCESS_KEY
- **Name**: `AWS_SECRET_ACCESS_KEY`
- **Secret**: Paste your Secret Access Key from Step 5 above
- Click **"Add secret"**

#### Secret 3: S3_BUCKET_NAME
- **Name**: `S3_BUCKET_NAME`
- **Secret**: `duo-mapping-client-app` (or whatever you named your bucket)
- Click **"Add secret"**

#### Secret 4: CLOUDFRONT_DISTRIBUTION_ID (Optional)
- **Name**: `CLOUDFRONT_DISTRIBUTION_ID`
- **Secret**: Leave empty for now (we'll add this if you set up CloudFront) ''
- Click **"Add secret"**

## Part 4: Test Your Setup

### Step 1: Verify S3 Bucket
1. Go back to your S3 bucket
2. Upload a simple test file (like a text file)
3. Try to access it via the website endpoint URL from Step 3 of Part 1

### Step 2: Test GitHub Actions
1. Make a small change to your code
2. Commit and push to the master branch:
```bash
git add .
git commit -m "Test AWS S3 deployment setup"
git push origin master
```
3. Go to your GitHub repository
4. Click on the **"Actions"** tab
5. Watch the deployment workflow run
6. If successful, your app will be live at your S3 website endpoint!

## Important Security Notes

### Access Key Security:
- ✅ **Never commit access keys to your repository**
- ✅ **Use GitHub Secrets for all sensitive information**
- ✅ **Rotate access keys regularly (every 90 days)**
- ✅ **Monitor CloudTrail for unexpected access**

### IAM Best Practices:
- ✅ **Principle of least privilege** - our policy only grants necessary permissions
- ✅ **No console access** - the user can only access via API
- ✅ **Specific resource ARNs** - limited to your specific bucket

### S3 Security:
- ✅ **Public read-only access** - people can view your website but not modify it
- ✅ **No write access from public** - only your GitHub Actions can upload files

## Troubleshooting Common Issues

### Issue: "Access Denied" when deploying
- **Solution**: Check that your IAM policy has the correct bucket name
- **Solution**: Verify the access keys are correctly set in GitHub Secrets

### Issue: "Bucket not found"
- **Solution**: Ensure the bucket name in GitHub Secrets exactly matches your bucket name
- **Solution**: Check that the bucket exists in the correct AWS region

### Issue: "403 Forbidden" when accessing website
- **Solution**: Verify the bucket policy is correctly set
- **Solution**: Ensure "Block all public access" is disabled

### Issue: GitHub Action fails on "npm run build"
- **Solution**: Ensure your package.json has a "build" script
- **Solution**: Check that all dependencies are listed in package.json

## Your Website URL

After successful deployment, your Angular app will be available at:
```
https://duo-mapping-client-app.s3-website-us-east-1.amazonaws.com
```
(Replace `duo-mapping-client-app` with your actual bucket name and `us-east-1` with your chosen region)

---

🎉 **Congratulations!** Your automatic deployment is now set up. Every time you push to the master branch, your app will automatically build and deploy to AWS S3!
