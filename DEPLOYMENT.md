# YouMap MCP Server - AWS ECS Deployment

This guide will help you deploy the YouMap MCP Server to AWS ECS Fargate with full CI/CD integration.

## Architecture

- **ECS Fargate**: Serverless containers for the MCP server
- **Application Load Balancer**: HTTPS endpoint with SSL termination
- **ECR**: Private Docker registry
- **CloudWatch**: Logging and monitoring
- **Systems Manager**: Secure parameter storage for secrets
- **GitHub Actions**: Automated CI/CD pipeline

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured
3. **Docker** installed
4. **Domain name** and **SSL certificate** in AWS Certificate Manager
5. **VPC** with at least 2 public subnets

## Quick Setup

### 1. Setup AWS Infrastructure

```bash
# Clone and navigate to the repository
cd youmap-mcp

# Setup AWS infrastructure
./scripts/setup-aws.sh production
```

This will prompt for:

- VPC ID
- Subnet IDs (comma-separated)
- Domain name (e.g., `mcp.youmap.com`)
- SSL Certificate ARN
- YouMap API credentials

### 2. Deploy the Application

```bash
# Deploy the MCP server
./scripts/deploy.sh production
```

### 3. Setup GitHub Actions (Optional)

For automated deployments, add these secrets to your GitHub repository:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

The CI/CD pipeline will:

- Build and test on every push
- Deploy to production on pushes to `main`/`master`
- Support tagged releases

## Manual Deployment Steps

### 1. Create ECR Repository

```bash
aws ecr create-repository --repository-name youmap-mcp --region us-east-1
```

### 2. Deploy Infrastructure

```bash
aws cloudformation deploy \
  --template-file aws/cloudformation.yaml \
  --stack-name youmap-mcp-production \
  --parameter-overrides \
    Environment=production \
    VpcId=vpc-xxxxxxxx \
    SubnetIds=subnet-xxxxxxxx,subnet-yyyyyyyy \
    DomainName=mcp.youmap.com \
    CertificateArn=arn:aws:acm:us-east-1:xxxxxxxx:certificate/xxxxxxxx \
    YouMapBaseUrl=https://developer.youmap.com/api/v1/ \
    YouMapClientId=your-client-id \
    YouMapClientSecret=your-client-secret \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### 3. Build and Push Docker Image

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t youmap-mcp .
docker tag youmap-mcp:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/youmap-mcp:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/youmap-mcp:latest
```

### 4. Update ECS Service

```bash
# Update task definition placeholders
sed -i 's/ACCOUNT_ID/123456789012/g' aws/task-definition.json
sed -i 's/REGION/us-east-1/g' aws/task-definition.json

# Register task definition
aws ecs register-task-definition --cli-input-json file://aws/task-definition.json

# Update service
aws ecs update-service \
  --cluster youmap-mcp-production \
  --service youmap-mcp-production \
  --task-definition youmap-mcp-production:1
```

## Testing the Deployment

### Health Check

```bash
curl https://mcp.youmap.com/health
```

Expected response:

```json
{
  "status": "healthy",
  "server": "youmap-mcp",
  "version": "1.0.0",
  "timestamp": "2025-10-12T10:30:00.000Z"
}
```

### List Available Tools

```bash
curl https://mcp.youmap.com/tools
```

### Call a Tool

```bash
curl -X POST https://mcp.youmap.com/call-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_maps",
    "arguments": {"limit": 5}
  }'
```

## Configuration

### Environment Variables

The service uses these environment variables:

- `NODE_ENV`: `production`
- `MCP_MODE`: `http`
- `PORT`: `3000`
- `YOUMAP_BASE_URL`: YouMap API base URL
- `YOUMAP_CLIENT_ID`: Your YouMap client ID (stored in SSM)
- `YOUMAP_CLIENT_SECRET`: Your YouMap client secret (stored in SSM)

### Scaling

To scale the service:

```bash
aws ecs update-service \
  --cluster youmap-mcp-production \
  --service youmap-mcp-production \
  --desired-count 4
```

### Monitoring

- **CloudWatch Logs**: `/ecs/youmap-mcp`
- **Health Check**: `https://your-domain/health`
- **ECS Console**: Monitor service health and metrics

## Using the Hosted MCP Server

Once deployed, you can connect external tools using:

**Base URL**: `https://mcp.youmap.com`

### Available Endpoints

- `GET /` - Server information
- `GET /health` - Health check
- `GET /tools` - List all available tools
- `POST /call-tool` - Execute a tool

### Example Integration

```javascript
const response = await fetch("https://mcp.youmap.com/call-tool", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "create_map",
    arguments: {
      name: "My New Map",
      description: "Created via API",
    },
  }),
});

const result = await response.json();
console.log(result);
```

## Troubleshooting

### Service Won't Start

1. Check CloudWatch logs in `/ecs/youmap-mcp`
2. Verify SSM parameters are set correctly
3. Ensure security groups allow traffic on port 3000

### SSL/Domain Issues

1. Verify certificate ARN is correct
2. Update DNS to point to ALB DNS name
3. Check Route 53 or your DNS provider configuration

### Authentication Issues

1. Verify YouMap credentials in SSM Parameter Store
2. Test credentials locally first
3. Check IAM roles and permissions

## Costs

Estimated monthly costs (us-east-1):

- ECS Fargate (2 tasks, 0.25 vCPU, 0.5 GB): ~$15
- Application Load Balancer: ~$16
- NAT Gateway (if using private subnets): ~$32
- Data transfer and other services: ~$5

**Total estimated**: ~$68/month

## Security

- All secrets stored in AWS Systems Manager Parameter Store
- ECS tasks run with minimal IAM permissions
- HTTPS enforced with SSL certificate
- Security groups restrict access to necessary ports only
- Container runs as non-root user

## Support

For issues with deployment or configuration:

1. Check CloudWatch logs
2. Review AWS CloudFormation events
3. Test locally using `npm run dev:server`
4. Open an issue in the GitHub repository
