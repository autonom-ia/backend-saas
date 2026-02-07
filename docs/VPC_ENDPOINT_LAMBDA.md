# VPC Endpoint para Lambda (invocar financial-service de dentro da VPC)

## Problema

A Lambda `createAccountOnboarding` do módulo **saas** roda dentro de uma **VPC** (para acessar RDS). Quando ela chama `Lambda.invoke()` para a Lambda do financial-service (`fin-account-subscriptions-production-createAccountSubscription`), a chamada vai para o endpoint da AWS Lambda (`lambda.us-east-1.amazonaws.com`). Sem saída para a internet (NAT) e sem **VPC Endpoint para Lambda**, a conexão dá **ETIMEDOUT** (ex.: `connect ETIMEDOUT 44.220.115.144:443`).

## Solução: Interface VPC Endpoint para Lambda

Crie um **Interface VPC Endpoint** para o serviço Lambda na mesma VPC (e subnets) onde a Lambda do saas está. Assim o tráfego para a API Lambda fica dentro da rede AWS e não precisa de NAT.

### Pré-requisitos

- **VPC ID** da VPC onde as Lambdas do saas rodam
- **Subnet IDs**: as mesmas do `serverless.yml` do saas (ex.: `subnet-07184b6cfa97367e2`, `subnet-000fbcffe0f8d9a11`)
- **Security group** que permita **saída** (egress) na porta 443; pode ser o mesmo security group das Lambdas (`sg-0e9189ca9e6d0427d`) ou um dedicado ao endpoint

### 1. Obter VPC ID a partir de uma subnet

```bash
aws ec2 describe-subnets \
  --subnet-ids subnet-07184b6cfa97367e2 \
  --region us-east-1 \
  --profile autonomia \
  --query "Subnets[0].VpcId" \
  --output text
```

Anote o `VpcId` (ex.: `vpc-xxxxxxxxx`).

### 2. Criar Security Group para o VPC Endpoint (opcional)

Se quiser um SG só para o endpoint:

```bash
VPC_ID="vpc-xxxxxxxxx"   # substitua pelo VpcId obtido acima
REGION="us-east-1"
PROFILE="autonomia"

aws ec2 create-security-group \
  --group-name "vpc-endpoint-lambda-sg" \
  --description "Security group for Lambda VPC endpoint" \
  --vpc-id "$VPC_ID" \
  --region "$REGION" \
  --profile "$PROFILE"
```

Anote o **GroupId** do output. Depois, garanta que o SG das suas Lambdas (ou o default da VPC) permite **entrada (ingress)** na porta 443 desse SG (ou 0.0.0.0/0). Na prática, muitas VPCs usam o mesmo SG das Lambdas para o endpoint.

### 3. Criar o VPC Endpoint para Lambda

Use o **service name** do Lambda na região `us-east-1`:

```bash
VPC_ID="vpc-xxxxxxxxx"
SUBNET_1="subnet-07184b6cfa97367e2"
SUBNET_2="subnet-000fbcffe0f8d9a11"
SG_ID="sg-0e9189ca9e6d0427d"   # security group das Lambdas saas; ou o criado no passo 2
REGION="us-east-1"
PROFILE="autonomia"

aws ec2 create-vpc-endpoint \
  --vpc-id "$VPC_ID" \
  --vpc-endpoint-type Interface \
  --service-name "com.amazonaws.${REGION}.lambda" \
  --subnet-ids "$SUBNET_1" "$SUBNET_2" \
  --security-group-ids "$SG_ID" \
  --region "$REGION" \
  --profile "$PROFILE"
```

Se a VPC tiver mais de duas subnets e as Lambdas rodarem em duas, use exatamente as duas subnets onde as Lambdas estão.

### 4. Verificar

O endpoint pode levar 1–2 minutos para ficar `available`. Verifique:

```bash
aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=com.amazonaws.us-east-1.lambda" \
  --region us-east-1 \
  --profile autonomia \
  --query "VpcEndpoints[0].State"
```

Depois disso, as Lambdas do saas na mesma VPC/subnets passam a conseguir chamar `Lambda.invoke()` para o financial-service sem ETIMEDOUT.

### Referência

- [AWS: Configuring interface VPC endpoints for Lambda](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc-endpoints.html)
