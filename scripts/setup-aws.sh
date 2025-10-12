#!/bin/bash

# Setup AWS infrastructure for YouMap MCP Server
# Usage: ./setup-aws.sh [environment]

set -e

ENVIRONMENT=${1:-production}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="youmap-mcp-$ENVIRONMENT"

echo "🏗️ Setting up AWS infrastructure for YouMap MCP Server"
echo "Environment: $ENVIRONMENT"
echo "AWS Region: $AWS_REGION"
echo "Stack Name: $STACK_NAME"

# Check if stack exists
if aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION >/dev/null 2>&1; then
  echo "📦 Stack exists, updating..."
  ACTION="update-stack"
else
  echo "🆕 Creating new stack..."
  ACTION="create-stack"
fi

# Get required parameters
echo "Please provide the following parameters:"

read -p "VPC ID: " VPC_ID
read -p "Subnet IDs (comma-separated): " SUBNET_IDS
read -p "Domain Name (e.g., mcp.youmap.com): " DOMAIN_NAME
read -p "SSL Certificate ARN: " CERTIFICATE_ARN
read -p "YouMap Base URL [https://developer.youmap.com/api/v1/]: " YOUMAP_BASE_URL
read -s -p "YouMap Client ID: " YOUMAP_CLIENT_ID
echo
read -s -p "YouMap Client Secret: " YOUMAP_CLIENT_SECRET
echo

# Set defaults
YOUMAP_BASE_URL=${YOUMAP_BASE_URL:-https://developer.youmap.com/api/v1/}

# Deploy CloudFormation stack
echo "🚀 Deploying CloudFormation stack..."

aws cloudformation $ACTION \
  --stack-name $STACK_NAME \
  --template-body file://aws/cloudformation.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=$ENVIRONMENT \
    ParameterKey=VpcId,ParameterValue=$VPC_ID \
    ParameterKey=SubnetIds,ParameterValue="$SUBNET_IDS" \
    ParameterKey=DomainName,ParameterValue=$DOMAIN_NAME \
    ParameterKey=CertificateArn,ParameterValue=$CERTIFICATE_ARN \
    ParameterKey=YouMapBaseUrl,ParameterValue=$YOUMAP_BASE_URL \
    ParameterKey=YouMapClientId,ParameterValue=$YOUMAP_CLIENT_ID \
    ParameterKey=YouMapClientSecret,ParameterValue=$YOUMAP_CLIENT_SECRET \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION

if [ "$ACTION" = "create-stack" ]; then
  echo "⏳ Waiting for stack creation to complete..."
  aws cloudformation wait stack-create-complete --stack-name $STACK_NAME --region $AWS_REGION
else
  echo "⏳ Waiting for stack update to complete..."
  aws cloudformation wait stack-update-complete --stack-name $STACK_NAME --region $AWS_REGION
fi

echo "✅ Infrastructure setup completed!"

# Get outputs
echo "📋 Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table

echo ""
echo "🎉 Infrastructure is ready!"
echo "Next steps:"
echo "1. Update your DNS to point $DOMAIN_NAME to the Load Balancer"
echo "2. Run ./scripts/deploy.sh $ENVIRONMENT to deploy your application"