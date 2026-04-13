# AWS Image Optimization Setup Guide

Follow these steps to deploy the automated image optimization pipeline.

---

## 1. IAM Roles & Permissions

You need two roles:
1. **Lambda S3 Optimizer Role**: For the S3 Trigger Lambda.
2. **Lambda@Edge Role**: For the CloudFront Origin Request function.

### A. Lambda S3 Optimizer (IAM)
**Permissions Policy:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["s3:GetObject", "s3:PutObject", "s3:HeadObject"],
            "Resource": "arn:aws:s3:::epanelimages/*"
        },
        {
            "Effect": "Allow",
            "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

### B. Lambda@Edge Execution Role
- Must be created in **us-east-1** (N. Virginia).
- **Trust Relationship**:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": [
                    "lambda.amazonaws.com",
                    "edgelambda.amazonaws.com"
                ]
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

---

## 2. Deploying the Pipelines

### Step A: Bulk Optimization (Existing Images)
1. Install dependencies locally: `npm install sharp @aws-sdk/client-s3 dotenv p-limit`
2. Configure `.env.local` with your AWS keys.
3. Run the script: `node aws-image-pipeline/optimize-existing.mjs`
   - *Optional:* Add `--all` to force recreate all optimized files.

### Step B: Automatic Optimization (New Images)
1. Create a new Lambda in your S3 region using **Node.js 20.x**.
2. **Layer Required**: `sharp` is a native binary. Use a pre-compiled Layer (e.g., from [K7L](https://github.com/K7L/sharp-lambda-layer)) or bundle it.
3. Upload `on-upload-lambda.js`.
4. Add **S3 Trigger**:
   - Bucket: `epanelimages`
   - Event: `s3:ObjectCreated:*`
   - Suffix: `.jpg` (and another for `.png`)

### Step C: CloudFront Format Negotiation
1. Create a new Lambda in **us-east-1** (N. Virginia).
2. Upload `origin-request-edge.js`.
3. **Deploy to Lambda@Edge**:
   - Distribution: Your CloudFront ID
   - Event: **Origin Request**
   - Cache Behavior: Default (*) or your images path.

---

## 3. CloudFront Cache Configuration

To ensure formats are cached correctly, you **MUST** configure CloudFront to vary caching by the `Accept` header.

1. Go to **Cache Key and Origin Requests** in CloudFront.
2. Under "Legacy cache settings", select **Headers**.
3. Select **Include the following headers** and add `Accept`.
4. This ensures Chrome gets AVIF cached, while Safari gets WebP cached for the same URL.

---

## 4. Local Config (.env)

Add these to your `.env`:
```bash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=epanelimages
```

---

## Summary of URL Logic

Requesting `https://cdn.example.com/products/shoe.jpg`:
- **Chrome**: Sends `Accept: image/avif`. CloudFront Edge rewrites request to `/products/shoe.avif`. S3 returns AVIF.
- **Safari**: Sends `Accept: image/webp`. CloudFront Edge rewrites request to `/products/shoe.webp`. S3 returns WebP.
- **Legacy Browser**: Sends default. CloudFront Edge leaves request as `/products/shoe.jpg`. S3 returns Original.
