#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { CdkLayerStack } from './stacks/CdkLayerStack'


const devEnv = {
    account: '664115809707',
    region: 'eu-central-1',
}

const app = new cdk.App()
new CdkLayerStack(app, 'CdkLayerStack', { env: devEnv })