#!/bin/bash

# Script to run RLS policy tests against the PostgreSQL database
# This script requires the database to be running and accessible

set -e

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-tau_kays}
DB_USER=${DB_USER:-tau_kays_user}
DB_PASSWORD=${DB_PASSWORD:-tau_kays_password}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}==============================================================================${NC}"
echo -e "${YELLOW}Running Row-Level Security (RLS) Policy Tests${NC}"
echo -e "${YELLOW}==============================================================================${NC}"

# Check if database is accessible
echo -e "${YELLOW}Checking database connection...${NC}"
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Cannot connect to database${NC}"
    echo "Please ensure the database is running and accessible with the following parameters:"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo ""
    echo "You can start the database with: docker-compose up -d postgres"
    exit 1
fi

echo -e "${GREEN}Database connection successful${NC}"

# Run the RLS test SQL script
echo -e "${YELLOW}Running RLS policy tests...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$(dirname "$0")/rls-policies.test.sql"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}==============================================================================${NC}"
    echo -e "${GREEN}All RLS policy tests completed successfully!${NC}"
    echo -e "${GREEN}==============================================================================${NC}"
else
    echo -e "${RED}==============================================================================${NC}"
    echo -e "${RED}RLS policy tests failed!${NC}"
    echo -e "${RED}==============================================================================${NC}"
    exit 1
fi