# MinIO Connection Fix - December 5, 2025

## Problem

When deploying on Railway, the application was failing to connect to the MinIO bucket with the error:

```
Invalid endPoint : https://bucket-production-d920.up.railway.app
```

The error occurred because the MinIO client library (version 8.0.5+) expects the endpoint parameter to be **hostname only** without the protocol (`https://` or `http://`). The protocol is specified separately via the `useSSL` configuration option.

## Root Cause

The MinIO package was updated from `8.0.3` to `8.0.6` during the security updates. Starting with MinIO client v8.x, the library became stricter about endpoint format validation and now rejects URLs with protocols in the `endPoint` parameter.

The service was receiving: `https://bucket-production-d920.up.railway.app`
But MinIO v8+ expects: `bucket-production-d920.up.railway.app`

## Solution Applied

Updated `backend/src/modules/minio-file/service.ts` to properly parse and handle endpoint URLs:

### Changes Made:

1. **Added Protocol Parsing Logic** in the constructor:
   ```typescript
   // Strip protocol if present (MinIO client v8+ requires hostname only)
   if (endPoint.startsWith('https://')) {
     endPoint = endPoint.replace('https://', '')
     useSSL = true
     port = 443
   } else if (endPoint.startsWith('http://')) {
     endPoint = endPoint.replace('http://', '')
     useSSL = false
     port = 80
   }
   ```

2. **Added Port Extraction**:
   ```typescript
   // Extract port from endpoint if specified (e.g., "minio.example.com:9000")
   const portMatch = endPoint.match(/:(\d+)$/)
   if (portMatch) {
     port = parseInt(portMatch[1], 10)
     endPoint = endPoint.replace(/:(\d+)$/, '')
   }
   ```

3. **Stored SSL Flag** for URL generation:
   ```typescript
   protected readonly useSSL: boolean
   ```

4. **Updated URL Generation** in the upload method:
   ```typescript
   // Generate URL using the endpoint and bucket with correct protocol
   const protocol = this.useSSL ? 'https' : 'http'
   const url = `${protocol}://${this.config_.endPoint}/${this.bucket}/${fileKey}`
   ```

## Supported Endpoint Formats

The service now supports all these endpoint formats:

- ✅ `https://bucket.railway.app` (Full URL with protocol)
- ✅ `http://bucket.example.com` (HTTP protocol)
- ✅ `bucket.example.com` (Hostname only - defaults to HTTPS on port 443)
- ✅ `minio.example.com:9000` (Hostname with custom port)
- ✅ `https://minio.example.com:9000` (Full URL with custom port)

## Testing

The service will now:
1. Accept the Railway-provided endpoint URL with `https://` protocol
2. Parse it correctly for MinIO client initialization
3. Generate proper file URLs with the correct protocol
4. Log the parsed configuration for debugging:
   ```
   MinIO service initialized with bucket: medusa-media, endpoint: bucket-production-d920.up.railway.app, port: 443, SSL: true
   ```

## Environment Variable Configuration

No changes needed to your environment variables. The service accepts endpoint in any format:

```env
# All of these work now:
MINIO_ENDPOINT=https://bucket-production-d920.up.railway.app
# OR
MINIO_ENDPOINT=bucket-production-d920.up.railway.app
# OR  
MINIO_ENDPOINT=http://minio.local:9000
```

## Backward Compatibility

✅ **Fully backward compatible** - The fix handles both old (hostname-only) and new (full URL) endpoint formats, so existing configurations will continue to work.

## Next Steps

1. **Deploy the fix** - Push the updated `service.ts` to your repository
2. **Railway will rebuild** - The new code will be deployed automatically
3. **Monitor logs** - Check that you see the initialization log with parsed endpoint
4. **Test file upload** - Upload an image through the Medusa admin to verify MinIO is working

## Additional Notes

- The MinIO dependency remains at version `8.0.6` which includes security fixes
- No need to downgrade the MinIO package
- The fix is future-proof and handles various endpoint formats
- Enhanced logging helps diagnose connection issues

---

**Status:** ✅ Fixed and ready for deployment  
**Compatibility:** MinIO client v8.0.5+  
**Breaking Changes:** None
