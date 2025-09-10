# AWS S3 Deployment Setup Guide

This guide will help you set up automatic deployment of your Angular app to AWS S3 using GitHub Actions.

## Prerequisites

- AWS Account
- GitHub repository (already configured ✅)
- Angular app (already configured ✅)

## Step 1: Create an S3 Bucket

1. Log into the AWS Console and navigate to S3
2. Click "Create bucket"
3. Choose a unique bucket name (e.g., `duo-mapping-client-app`)
4. Select your preferred region (default: `us-east-1`)
5. **Important**: Uncheck "Block all public access" since this will be a public website
6. Click "Create bucket"

## Step 2: Configure S3 for Static Website Hosting

1. Select your newly created bucket
2. Go to the "Properties" tab
3. Scroll down to "Static website hosting"
4. Click "Edit"
5. Select "Enable"
6. Set Index document to: `index.html`
7. Set Error document to: `index.html` (for Angular routing)
8. Click "Save changes"

## Step 3: Set Bucket Policy

1. Go to the "Permissions" tab of your bucket
2. Scroll down to "Bucket policy"
3. Click "Edit"
4. Copy the contents from `s3-bucket-policy.json` in this repository
5. Replace `YOUR_BUCKET_NAME` with your actual bucket name
6. Click "Save changes"

## Step 4: Create IAM User for GitHub Actions

1. Go to IAM in the AWS Console
2. Click "Users" → "Create user"
3. Enter username: `github-actions-s3-deploy`
4. Click "Next"
5. Select "Attach policies directly"
6. Create a custom policy with these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR_BUCKET_NAME",
                "arn:aws:s3:::YOUR_BUCKET_NAME/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation"
            ],
            "Resource": "*"
        }
    ]
}
```

7. Attach this policy to the user
8. Click "Create user"

## Step 5: Generate Access Keys

1. Select the user you just created
2. Go to "Security credentials" tab
3. Click "Create access key"
4. Select "Application running outside AWS"
5. Click "Next" → "Create access key"
6. **Important**: Copy both the Access Key ID and Secret Access Key

## Step 6: Configure GitHub Secrets

1. Go to your GitHub repository
2. Click "Settings" → "Secrets and variables" → "Actions"
3. Click "New repository secret" and add these secrets:

   - `AWS_ACCESS_KEY_ID`: Your AWS Access Key ID
   - `AWS_SECRET_ACCESS_KEY`: Your AWS Secret Access Key
   - `S3_BUCKET_NAME`: Your S3 bucket name
   - `CLOUDFRONT_DISTRIBUTION_ID`: (Optional) If you set up CloudFront

## Step 7: Optional - Set up CloudFront (Recommended)

CloudFront provides:
- Global CDN for faster loading
- HTTPS support
- Custom domain support

1. Go to CloudFront in AWS Console
2. Click "Create distribution"
3. Set Origin domain to your S3 website endpoint (found in S3 bucket properties)
4. Set Default root object to: `index.html`
5. Configure error pages:
   - Error code: `403`, Response code: `200`, Response page: `/index.html`
   - Error code: `404`, Response code: `200`, Response page: `/index.html`
6. Create distribution
7. Add the Distribution ID to GitHub secrets as `CLOUDFRONT_DISTRIBUTION_ID`

## How It Works

The GitHub Action will:

1. ✅ **Trigger**: Runs on pushes to `main`/`master` branches or when PRs are merged
2. ✅ **Build**: Installs dependencies and builds your Angular app for production
3. ✅ **Deploy**: Syncs the built files to your S3 bucket
4. ✅ **Cache Invalidation**: (Optional) Clears CloudFront cache if configured
5. ✅ **Notification**: Shows success message with your app URL

## Your App URLs

After deployment, your app will be available at:

- **S3 Website**: `https://YOUR_BUCKET_NAME.s3-website-us-east-1.amazonaws.com`
- **CloudFront** (if configured): `https://YOUR_DISTRIBUTION_ID.cloudfront.net`
- **Custom Domain** (if configured): Your custom domain

## Testing the Deployment

1. Make a change to your app
2. Commit and push to the `master` branch:
   ```bash
   git add .
   git commit -m "Test deployment"
   git push origin master
   ```
3. Go to the "Actions" tab in your GitHub repository
4. Watch the deployment process
5. Once complete, visit your S3 website URL

## Troubleshooting

- **403 Forbidden**: Check bucket policy and public access settings
- **404 Not Found**: Verify S3 static website hosting is enabled
- **Build Fails**: Check that all dependencies are in `package.json`
- **GitHub Action Fails**: Verify all secrets are correctly set

## Security Notes

- The IAM user has minimal permissions needed for deployment
- Consider using temporary credentials for enhanced security
- Regularly rotate access keys
- Monitor CloudTrail for access logs

---

🚀 **You're all set!** Your Angular app will now automatically deploy to AWS S3 whenever you push changes to the master branch.
