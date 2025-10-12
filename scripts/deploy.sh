#!/bin/bash

# Deploy YouMap MCP Server to AWS ECS
# Usage: ./deploy.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-production}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🚀 Deploying YouMap MCP Server"
echo "Environment: $ENVIRONMENT"
echo "AWS Region: $AWS_REGION"
echo "AWS Account: $AWS_ACCOUNT_ID"

# Build and push Docker image
echo "📦 Building Docker image..."
REPOSITORY_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/youmap-mcp"
IMAGE_TAG="latest"

# Login to ECR
echo "🔐 Logging in to Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI

# Build image
echo "🔨 Building Docker image..."
docker build -t youmap-mcp .
docker tag youmap-mcp:latest $REPOSITORY_URI:$IMAGE_TAG
docker tag youmap-mcp:latest $REPOSITORY_URI:$(git rev-parse --short HEAD)

# Push image
echo "⬆️ Pushing image to ECR..."
docker push $REPOSITORY_URI:$IMAGE_TAG
docker push $REPOSITORY_URI:$(git rev-parse --short HEAD)

# Update task definition
echo "📝 Updating ECS task definition..."
TASK_DEFINITION_FILE="aws/task-definition.json"

# Replace placeholders in task definition
sed -i.bak \
  -e "s/ACCOUNT_ID/$AWS_ACCOUNT_ID/g" \
  -e "s/REGION/$AWS_REGION/g" \
  $TASK_DEFINITION_FILE

# Register new task definition
TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://$TASK_DEFINITION_FILE \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ Registered task definition: $TASK_DEFINITION_ARN"

# Update ECS service
echo "🔄 Updating ECS service..."
aws ecs update-service \
  --cluster "youmap-mcp-$ENVIRONMENT" \
  --service "youmap-mcp-$ENVIRONMENT" \
  --task-definition "$TASK_DEFINITION_ARN" \
  --desired-count 2

# Wait for deployment to complete
echo "⏳ Waiting for service to reach stable state..."
aws ecs wait services-stable \
  --cluster "youmap-mcp-$ENVIRONMENT" \
  --services "youmap-mcp-$ENVIRONMENT"

echo "✅ Deployment completed successfully!"

# Restore original task definition file
mv $TASK_DEFINITION_FILE.bak $TASK_DEFINITION_FILE

# Get service endpoint
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names "youmap-mcp-$ENVIRONMENT" \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "🌐 Service endpoint: https://$ALB_DNS"
echo "🏥 Health check: https://$ALB_DNS/health"