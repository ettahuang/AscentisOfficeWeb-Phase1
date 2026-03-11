# Image Registry Rules

## Registry Information

- Registry URL: https://docker.owgps.net/
- Project Image Name: at-devops-playground-demo

## Image Naming Convention

### Format

```bash
docker.owgps.net/at-devops-playground-demo:<tag>
```

### Tag Strategy

1. **Development Build**

```bash
dev-$(tmp=${CI_PIPELINE_CREATED_AT//-/};echo ${tmp:0:8})-$CI_PIPELINE_ID-$CI_COMMIT_REF_SLUG
```

Example: `dev-20240327-123456-feature-demo`

2. **Production Build**

```bash
prod-$(tmp=${CI_PIPELINE_CREATED_AT//-/};echo ${tmp:0:8})-$CI_PIPELINE_ID-$CI_COMMIT_REF_SLUG
```

Example: `prod-20240327-123456-main`

3. **Latest Tags**

```bash
latest-<ENVIRONMENT>
```

Examples:
- `latest-jpcg`
- `latest-twt1p`
- `latest-kltwp`

## Image Operations

### Pull Command

```bash
docker pull docker.owgps.net/at-devops-playground-demo:<tag>
```

### Push Command

```bash
docker push docker.owgps.net/at-devops-playground-demo:<tag>
```

## Lifecycle Management

### Retention Policies

| Tag Type | Retention Period | Auto Cleanup |
|----------|------------------|--------------|
| `dev-xxx` | 2 weeks | Yes |
| `prod-xxx` | Permanent | No |
| `latest-xxx` | Single per env | No |

### Policy Details

1. **Development Tags (`dev-xxx`)**
   - Retention period: 2 weeks
   - Automatic cleanup enabled
   - Used for development and testing

2. **Production Tags (`prod-xxx`)**
   - No automatic deletion
   - Permanent retention
   - Used for production deployments

3. **Latest Tags (`latest-xxx`)**
   - Single tag per environment
   - Updated with each successful deployment
   - No automatic deletion

## Technical Constraints

| Constraint | Limit |
|------------|-------|
| Image Tag maximum length | 128 bytes |
| CI_COMMIT_REF_SLUG maximum length | 63 bytes |

## Deployment Process

### Deploy Job Workflow

1. Send deployment start notification
2. Tag image for production
3. Tag image as latest
4. Update deployment
5. Send deployment completion notification

### AWS CLI Tagging Operations

```bash
# Production tag
aws ecr tag xxx:$SOURCE_TAG xxx:prod-$TAG

# Latest tag
aws ecr tag xxx:$SOURCE_TAG xxx:latest-$TAG
```

## Best Practices

1. **Always use specific tags for deployments**
   - Avoid using `latest` tag in production
   - Use versioned tags for traceability

2. **Include build metadata in image labels**
   - Build timestamp
   - Git commit SHA
   - Pipeline ID

3. **Perform security scans before pushing**
   - Run vulnerability scans
   - Check for exposed secrets

4. **Maintain documentation for custom tags**
   - Document any non-standard tag formats
   - Keep naming conventions consistent

## GitLab CI/CD Example

```yaml
variables:
  IMAGE_NAME: docker.owgps.net/at-devops-playground-demo
  DEV_TAG: dev-${CI_PIPELINE_CREATED_AT}-${CI_PIPELINE_ID}-${CI_COMMIT_REF_SLUG}
  PROD_TAG: prod-${CI_PIPELINE_CREATED_AT}-${CI_PIPELINE_ID}-${CI_COMMIT_REF_SLUG}

build:
  stage: build
  script:
    - docker build -t ${IMAGE_NAME}:${DEV_TAG} .
    - docker push ${IMAGE_NAME}:${DEV_TAG}
  only:
    - branches

deploy-prod:
  stage: deploy
  script:
    - docker tag ${IMAGE_NAME}:${DEV_TAG} ${IMAGE_NAME}:${PROD_TAG}
    - docker tag ${IMAGE_NAME}:${DEV_TAG} ${IMAGE_NAME}:latest-prod
    - docker push ${IMAGE_NAME}:${PROD_TAG}
    - docker push ${IMAGE_NAME}:latest-prod
  only:
    - main
  when: manual
```

## Checklist

Before pushing images:

- [ ] Tag follows naming convention
- [ ] Tag length is within 128 bytes limit
- [ ] Security scan completed
- [ ] No secrets exposed in image
- [ ] Build metadata labels added
- [ ] Correct registry URL used
