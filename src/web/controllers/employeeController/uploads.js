const { uploadBufferToCloudinary } = require('../../../config/cloudinary');

function trimBodyStrings(body = {}) {
  const data = {};
  Object.keys(body).forEach((key) => {
    data[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
  });
  return data;
}

async function uploadEmployeeFile(file, actorKey) {
  if (file.fieldname === 'avatar') {
    return {
      kind: 'avatar',
      url: await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/avatars', { actorKey }),
    };
  }

  if (file.fieldname === 'document_contract') {
    return {
      kind: 'contract',
      url: await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/contracts', { actorKey }),
    };
  }

  if (file.fieldname === 'document_deployment_order') {
    return {
      kind: 'deploymentOrder',
      url: await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/deployment_orders', { actorKey }),
    };
  }

  if (file.fieldname.startsWith('document_')) {
    return {
      kind: 'clearance',
      type: file.fieldname.replace('document_', ''),
      url: await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/documents', { actorKey }),
    };
  }

  return { kind: 'ignored' };
}

async function processEmployeeUploads(files = [], actorKey) {
  const uploads = {
    avatarUrl: null,
    contractDocUrl: null,
    deploymentOrderUrl: null,
    clearancesData: [],
  };

  for (const file of files) {
    const uploaded = await uploadEmployeeFile(file, actorKey);
    if (uploaded.kind === 'avatar') {
      uploads.avatarUrl = uploaded.url;
    } else if (uploaded.kind === 'contract') {
      uploads.contractDocUrl = uploaded.url;
    } else if (uploaded.kind === 'deploymentOrder') {
      uploads.deploymentOrderUrl = uploaded.url;
    } else if (uploaded.kind === 'clearance') {
      uploads.clearancesData.push({ type: uploaded.type, url: uploaded.url });
    }
  }

  return uploads;
}

async function processDeploymentOrderUpload(files = [], actorKey) {
  if (files.some((file) => file.fieldname === 'document_contract')) {
    const err = new Error('Employment contract uploads are only allowed through employee onboarding or contract renewal.');
    err.status = 400;
    throw err;
  }

  let deploymentOrderUrl = null;
  for (const file of files) {
    if (file.fieldname === 'document_deployment_order') {
      deploymentOrderUrl = await uploadBufferToCloudinary(
        file.buffer,
        'prism_guard/employees/deployment_orders',
        { actorKey }
      );
    }
  }

  return deploymentOrderUrl;
}

module.exports = {
  trimBodyStrings,
  processEmployeeUploads,
  processDeploymentOrderUpload,
};
