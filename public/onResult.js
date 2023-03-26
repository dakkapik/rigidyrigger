function setBody(results, skeleton) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );
  
    {
      canvasCtx.globalCompositeOperation = "destination-atop";
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );
      canvasCtx.globalCompositeOperation = "source-over";
      drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 1,
      });
      drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: "#FF0000",
        radius: 0.5,
      });
      drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {
        color: "#CC0000",
        lineWidth: 1,
      });
      drawLandmarks(canvasCtx, results.leftHandLandmarks, {
        color: "#00FF00",
        lineWidth: 0.5,
      });
      drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {
        color: "#00CC00",
        lineWidth: 1,
      });
      drawLandmarks(canvasCtx, results.rightHandLandmarks, {
        color: "#00FFFF",
        lineWidth: 0.5,
      });
      canvasCtx.restore();
    }
  
    function update3dpose(camera, dist_from_cam, offset, poseLandmarks) {
      // if the camera is orthogonal, set scale to 1
      const ip_lt = new THREE.Vector3(-1, 1, -1).unproject(camera);
      const ip_rb = new THREE.Vector3(1, -1, -1).unproject(camera);
      const ip_diff = new THREE.Vector3().subVectors(ip_rb, ip_lt);
      const x_scale = Math.abs(ip_diff.x);
  
      function ProjScale(p_ms, cam_pos, src_d, dst_d) {
        let vec_cam2p = new THREE.Vector3().subVectors(p_ms, cam_pos);
        return new THREE.Vector3().addVectors(
          cam_pos,
          vec_cam2p.multiplyScalar(dst_d / src_d)
        );
      }
  
      let pose3dDict = {};
      for (const [key, value] of Object.entries(poseLandmarks)) {
        let p_3d = new THREE.Vector3(
          (value.x - 0.5) * 2.0,
          -(value.y - 0.5) * 2.0,
          0
        ).unproject(camera);
        p_3d.z = -value.z * x_scale - camera.near + camera.position.z;
        p_3d = ProjScale(p_3d, camera.position, camera.near, dist_from_cam);
        pose3dDict[key] = p_3d.add(offset);
      }
  
      return pose3dDict;
    }
  
    function SetRbyCalculatingJoints(
      joint_mp,
      joint_mp_child,
      joint_model,
      joint_model_child,
      R_chain
    ) {
      const v = new THREE.Vector3()
        .subVectors(joint_mp_child, joint_mp)
        .normalize();
  
      const R = computeR(
        joint_model_child.position.clone().normalize(),
        v.applyMatrix4(R_chain.clone().transpose())
      );
      joint_model.quaternion.setFromRotationMatrix(R);
  
      R_chain.multiply(R);
    }
    let R_chain_rightupper, R_chain_leftupper;
    let pose_left_wrist, pose_right_wrist;
  
    if (results.poseLandmarks) {
      // pose
      let pose_landmarks_dict = {};
      let newJoints3D = {};
      results.poseLandmarks.forEach((landmark, i) => {
        pose_landmarks_dict[index_to_name[i]] = landmark;
      });
  
      let pos_3d_landmarks = update3dpose(
        camera_world,
        1.5,
        new THREE.Vector3(1, 0, -1.5),
        pose_landmarks_dict
      );
  
      let i = 0;
      for (const [key, value] of Object.entries(pos_3d_landmarks)) {
        poselandmarks_points.geometry.attributes.position.array[3 * i + 0] =
          value.x;
        poselandmarks_points.geometry.attributes.position.array[3 * i + 1] =
          value.y;
        poselandmarks_points.geometry.attributes.position.array[3 * i + 2] =
          value.z;
        i++;
      }
      poselandmarks_points.geometry.attributes.position.needsUpdate = true;
      pose_left_wrist = pos_3d_landmarks["left_wrist"];
      pose_right_wrist = pos_3d_landmarks["right_wrist"];
      // add landmarks for spine
      const center_hips = new THREE.Vector3()
        .addVectors(pos_3d_landmarks["left_hip"], pos_3d_landmarks["right_hip"])
        .multiplyScalar(0.5);
      const center_shoulders = new THREE.Vector3()
        .addVectors(
          pos_3d_landmarks["left_shoulder"],
          pos_3d_landmarks["right_shoulder"]
        )
        .multiplyScalar(0.5);
      const center_ear = new THREE.Vector3()
        .addVectors(pos_3d_landmarks["left_ear"], pos_3d_landmarks["right_ear"])
        .multiplyScalar(0.5);
  
      const dir_spine = new THREE.Vector3().subVectors(
        center_shoulders,
        center_hips
      );
      const length_spine = dir_spine.length();
      dir_spine.normalize();
  
      const dir_shoulders = new THREE.Vector3().subVectors(
        pos_3d_landmarks["right_shoulder"],
        pos_3d_landmarks["left_shoulder"]
      );
  
      newJoints3D["hips"] = new THREE.Vector3().addVectors(
        center_hips,
        dir_spine.clone().multiplyScalar(length_spine / 9.0)
      );
      newJoints3D["spine0"] = new THREE.Vector3().addVectors(
        center_hips,
        dir_spine.clone().multiplyScalar((length_spine / 9.0) * 3)
      );
      newJoints3D["spine1"] = new THREE.Vector3().addVectors(
        center_hips,
        dir_spine.clone().multiplyScalar((length_spine / 9.0) * 5)
      );
      newJoints3D["spine2"] = new THREE.Vector3().addVectors(
        center_hips,
        dir_spine.clone().multiplyScalar((length_spine / 9.0) * 7)
      );
      const neck = new THREE.Vector3().addVectors(
        center_shoulders,
        dir_spine.clone().multiplyScalar(length_spine / 9.0)
      );
      newJoints3D["neck"] = neck;
      newJoints3D["shoulder_left"] = new THREE.Vector3().addVectors(
        pos_3d_landmarks["left_shoulder"],
        dir_shoulders.clone().multiplyScalar(1 / 3.0)
      );
      newJoints3D["shoulder_right"] = new THREE.Vector3().addVectors(
        pos_3d_landmarks["left_shoulder"],
        dir_shoulders.clone().multiplyScalar(2 / 3.0)
      );
      const dir_head = new THREE.Vector3().subVectors(center_ear, neck);
      newJoints3D["head"] = new THREE.Vector3().addVectors(
        neck,
        dir_head.clone().multiplyScalar(0.5)
      );
      const dir_right_foot = new THREE.Vector3().subVectors(
        pos_3d_landmarks["right_foot_index"],
        pos_3d_landmarks["right_heel"]
      );
      newJoints3D["right_toebase"] = new THREE.Vector3().addVectors(
        pos_3d_landmarks["right_heel"],
        dir_right_foot.clone().multiplyScalar(0.6)
      );
      const dir_left_foot = new THREE.Vector3().subVectors(
        pos_3d_landmarks["left_foot_index"],
        pos_3d_landmarks["left_heel"]
      );
      newJoints3D["left_toebase"] = new THREE.Vector3().addVectors(
        pos_3d_landmarks["left_heel"],
        dir_left_foot.clone().multiplyScalar(0.6)
      );
  
      i = 0;
      for (const [key, value] of Object.entries(newJoints3D)) {
        Newposelandmarks_points.geometry.attributes.position.array[3 * i + 0] =
          value.x;
        Newposelandmarks_points.geometry.attributes.position.array[3 * i + 1] =
          value.y;
        Newposelandmarks_points.geometry.attributes.position.array[3 * i + 2] =
          value.z;
        i++;
      }
      Newposelandmarks_points.geometry.attributes.position.needsUpdate = true;
  
      // hip
      const jointHips = newJoints3D["hips"];
      const jointLeftUpLeg = pos_3d_landmarks["left_hip"];
      const jointRightUpLeg = pos_3d_landmarks["right_hip"];
      const jointSpine0 = newJoints3D["spine0"];
  
      const boneHips = skeleton.getBoneByName("mixamorigHips");
      const boneLeftUpLeg = skeleton.getBoneByName("mixamorigLeftUpLeg");
      const boneRightUpLeg = skeleton.getBoneByName("mixamorigRightUpLeg");
      const boneSpine0 = skeleton.getBoneByName("mixamorigSpine");
  
      const v_HiptoLeft = new THREE.Vector3()
        .subVectors(jointLeftUpLeg, jointHips)
        .normalize();
      const v_HiptoRight = new THREE.Vector3()
        .subVectors(jointRightUpLeg, jointHips)
        .normalize();
      const v_HiptoSpine0 = new THREE.Vector3()
        .subVectors(jointSpine0, jointHips)
        .normalize();
  
      const R_HiptoLeft = computeR(
        boneLeftUpLeg.position.clone().normalize(),
        v_HiptoLeft
      );
      const Q_HiptoLeft = new THREE.Quaternion().setFromRotationMatrix(
        R_HiptoLeft
      );
      const R_HiptoRight = computeR(
        boneRightUpLeg.position.clone().normalize(),
        v_HiptoRight
      );
      const Q_HiptoRight = new THREE.Quaternion().setFromRotationMatrix(
        R_HiptoRight
      );
      const R_HiptoSpine0 = computeR(
        boneSpine0.position.clone().normalize(),
        v_HiptoSpine0
      );
      const Q_HiptoSpine0 = new THREE.Quaternion().setFromRotationMatrix(
        R_HiptoSpine0
      );
      const Q_Hips = new THREE.Quaternion()
        .copy(Q_HiptoSpine0)
        .slerp(Q_HiptoLeft.clone().slerp(Q_HiptoRight, 0.5), 1 / 3);
  
      boneHips.quaternion.copy(Q_Hips);
      const R_Hips = new THREE.Matrix4().extractRotation(boneHips.matrix);
  
      // neck
      let R_chain_neck = new THREE.Matrix4().identity();
      R_chain_neck.multiply(R_Hips);
      const jointNeck = newJoints3D["neck"];
      const jointHead = newJoints3D["head"];
      const boneNeck = skeleton.getBoneByName("mixamorigNeck");
      const boneHead = skeleton.getBoneByName("mixamorigHead");
      SetRbyCalculatingJoints(
        jointNeck,
        jointHead,
        boneNeck,
        boneHead,
        R_chain_neck
      );
      const jointLeftEye = pos_3d_landmarks["left_eye"];
      const jointRightEye = pos_3d_landmarks["right_eye"];
      const boneLeftEye = skeleton.getBoneByName("mixamorigLeftEye");
      const boneRightEye = skeleton.getBoneByName("mixamorigRightEye");
      const v_LeftEye = new THREE.Vector3()
        .subVectors(jointLeftEye, jointHead)
        .normalize();
      const v_RightEye = new THREE.Vector3()
        .subVectors(jointRightEye, jointHead)
        .normalize();
      const R_HeadtoLeftEye = computeR(
        boneLeftEye.position.clone().normalize(),
        v_LeftEye.clone().applyMatrix4(R_chain_neck.clone().transpose())
      );
      const R_HeadtoRightEye = computeR(
        boneRightEye.position.clone().normalize(),
        v_RightEye.clone().applyMatrix4(R_chain_neck.clone().transpose())
      );
      const Q_HeadtoLeftEye = new THREE.Quaternion().setFromRotationMatrix(
        R_HeadtoLeftEye
      );
      const Q_HeadtoRightEye = new THREE.Quaternion().setFromRotationMatrix(
        R_HeadtoRightEye
      );
      const Q_Head = new THREE.Quaternion()
        .copy(Q_HeadtoLeftEye)
        .slerp(Q_HeadtoRightEye, 0.5);
      boneHead.quaternion.copy(Q_Head);
  
      // Left shoulder-elbow-wrist
      R_chain_leftupper = new THREE.Matrix4().identity();
      R_chain_leftupper.multiply(R_Hips);
      const jointLeftShoulder_inside = newJoints3D["shoulder_left"];
      const jointLeftShoulder = pos_3d_landmarks["left_shoulder"];
      const jointLeftElbow = pos_3d_landmarks["left_elbow"];
      const jointLeftWrist = pos_3d_landmarks["left_wrist"];
  
      const boneLeftShoulder = skeleton.getBoneByName("mixamorigLeftShoulder");
      const boneLeftArm = skeleton.getBoneByName("mixamorigLeftArm");
      const boneLeftForeArm = skeleton.getBoneByName("mixamorigLeftForeArm");
      const boneLeftHand = skeleton.getBoneByName("mixamorigLeftHand");
  
      SetRbyCalculatingJoints(
        jointLeftShoulder_inside,
        jointLeftShoulder,
        boneLeftShoulder,
        boneLeftArm,
        R_chain_leftupper
      );
      SetRbyCalculatingJoints(
        jointLeftShoulder,
        jointLeftElbow,
        boneLeftArm,
        boneLeftForeArm,
        R_chain_leftupper
      );
      SetRbyCalculatingJoints(
        jointLeftElbow,
        jointLeftWrist,
        boneLeftForeArm,
        boneLeftHand,
        R_chain_leftupper
      );
  
      // Right shoulder-elbow-wrist
      R_chain_rightupper = new THREE.Matrix4().identity();
      R_chain_rightupper.multiply(R_Hips);
      const jointRightShoulder_inside = newJoints3D["shoulder_left"];
      const jointRightShoulder = pos_3d_landmarks["right_shoulder"];
      const jointRightElbow = pos_3d_landmarks["right_elbow"];
      const jointRightWrist = pos_3d_landmarks["right_wrist"];
  
      const boneRightShoulder = skeleton.getBoneByName("mixamorigRightShoulder");
      const boneRightArm = skeleton.getBoneByName("mixamorigRightArm");
      const boneRightForeArm = skeleton.getBoneByName("mixamorigRightForeArm");
      const boneRightHand = skeleton.getBoneByName("mixamorigRightHand");
  
      SetRbyCalculatingJoints(
        jointRightShoulder_inside,
        jointRightShoulder,
        boneRightShoulder,
        boneRightArm,
        R_chain_rightupper
      );
      SetRbyCalculatingJoints(
        jointRightShoulder,
        jointRightElbow,
        boneRightArm,
        boneRightForeArm,
        R_chain_rightupper
      );
      SetRbyCalculatingJoints(
        jointRightElbow,
        jointRightWrist,
        boneRightForeArm,
        boneRightHand,
        R_chain_rightupper
      );
  
      // left upleg-leg-foot
      let R_chain_leftlower = new THREE.Matrix4().identity();
      R_chain_leftlower.multiply(R_Hips);
      const jointLeftKnee = pos_3d_landmarks["left_knee"];
      const jointLeftAnkle = pos_3d_landmarks["left_ankle"];
      const jointLeftToeBase = newJoints3D["left_toebase"];
      const jointLeftFoot = pos_3d_landmarks["left_foot_index"];
  
      const boneLeftLeg = skeleton.getBoneByName("mixamorigLeftLeg");
      const boneLeftFoot = skeleton.getBoneByName("mixamorigLeftFoot");
      const boneLeftToeBase = skeleton.getBoneByName("mixamorigLeftToeBase");
      const boneLeftToe_End = skeleton.getBoneByName("mixamorigLeftToe_End");
      SetRbyCalculatingJoints(
        jointLeftUpLeg,
        jointLeftKnee,
        boneLeftUpLeg,
        boneLeftLeg,
        R_chain_leftlower
      );
      SetRbyCalculatingJoints(
        jointLeftKnee,
        jointLeftAnkle,
        boneLeftLeg,
        boneLeftFoot,
        R_chain_leftlower
      );
      SetRbyCalculatingJoints(
        jointLeftAnkle,
        jointLeftToeBase,
        boneLeftFoot,
        boneLeftToeBase,
        R_chain_leftlower
      );
      SetRbyCalculatingJoints(
        jointLeftToeBase,
        jointLeftFoot,
        boneLeftToeBase,
        boneLeftToe_End,
        R_chain_leftlower
      );
      // Right upleg-leg-foot
      let R_chain_rightlower = new THREE.Matrix4().identity();
      R_chain_rightlower.multiply(R_Hips);
  
      const jointRightKnee = pos_3d_landmarks["right_knee"];
      const jointRightAnkle = pos_3d_landmarks["right_ankle"];
      const jointRightToeBase = newJoints3D["right_toebase"];
      const jointRightFoot = pos_3d_landmarks["right_foot_index"];
  
      const boneRightLeg = skeleton.getBoneByName("mixamorigRightLeg");
      const boneRightFoot = skeleton.getBoneByName("mixamorigRightFoot");
      const boneRightToeBase = skeleton.getBoneByName("mixamorigRightToeBase");
      const boneRightToe_End = skeleton.getBoneByName("mixamorigRightToe_End");
  
      SetRbyCalculatingJoints(
        jointRightUpLeg,
        jointRightKnee,
        boneRightUpLeg,
        boneRightLeg,
        R_chain_rightlower
      );
      SetRbyCalculatingJoints(
        jointRightKnee,
        jointRightAnkle,
        boneRightLeg,
        boneRightFoot,
        R_chain_rightlower
      );
      SetRbyCalculatingJoints(
        jointRightAnkle,
        jointRightToeBase,
        boneRightFoot,
        boneRightToeBase,
        R_chain_rightlower
      );
      SetRbyCalculatingJoints(
        jointRightToeBase,
        jointRightFoot,
        boneRightToeBase,
        boneRightToe_End,
        R_chain_rightlower
      );
    }
    if (results.leftHandLandmarks) {
      let hand_landmarks_dict = {};
      results.leftHandLandmarks.forEach((landmark, i) => {
        hand_landmarks_dict[index_to_name_hands[i]] = landmark;
      });
      let hand_3d_landmarks = update3dpose(
        camera_world,
        1.5,
        new THREE.Vector3(1, 0, -1.5),
        hand_landmarks_dict
      );
      let i = 0;
      const gap_X = pose_left_wrist.x - hand_3d_landmarks["wrist"].x;
      const gap_Y = pose_left_wrist.y - hand_3d_landmarks["wrist"].y;
      const gap_Z = pose_left_wrist.z - hand_3d_landmarks["wrist"].z;
      for (const [key, value] of Object.entries(hand_3d_landmarks)) {
        value.x += gap_X;
        value.y += gap_Y;
        value.z += gap_Z;
        l_handlandmarks_points.geometry.attributes.position.array[3 * i + 0] =
          value.x;
        l_handlandmarks_points.geometry.attributes.position.array[3 * i + 1] =
          value.y;
        l_handlandmarks_points.geometry.attributes.position.array[3 * i + 2] =
          value.z;
        i++;
      }
      l_handlandmarks_points.geometry.attributes.position.needsUpdate = true;
      const jointWrist = hand_3d_landmarks["wrist"];
      const jointIndex_mcp = hand_3d_landmarks["index_finger_mcp"];
      const jointMiddle_mcp = hand_3d_landmarks["middle_finger_mcp"];
      const jointPinky_mcp = hand_3d_landmarks["pinky_finger_mcp"];
  
      const boneHand = skeleton.getBoneByName("mixamorigLeftHand");
      const boneIndex1 = skeleton.getBoneByName("mixamorigLeftHandIndex1");
      const boneMiddle1 = skeleton.getBoneByName("mixamorigLeftHandMiddle1");
      const bonePinky1 = skeleton.getBoneByName("mixamorigLeftHandPinky1");
  
      const v_middle = new THREE.Vector3().subVectors(
        jointMiddle_mcp,
        jointWrist
      );
  
      const v_hand_v = v_middle.clone().normalize();
      const v_hand_index2pinky = new THREE.Vector3()
        .subVectors(jointPinky_mcp, jointIndex_mcp)
        .normalize();
      const v_hand_w = new THREE.Vector3().crossVectors(
        v_hand_index2pinky,
        v_hand_v
      );
      const v_hand_u = new THREE.Vector3().crossVectors(v_hand_v, v_hand_w);
      const R_MPhand = new THREE.Matrix4().makeBasis(
        v_hand_u,
        v_hand_v,
        v_hand_w
      );
  
      const v_bonehand_v = boneMiddle1.clone().position.normalize();
      const v_bonehand_index2pinky = new THREE.Vector3()
        .subVectors(bonePinky1.position, boneIndex1.position)
        .normalize();
      const v_bonehand_w = new THREE.Vector3().crossVectors(
        v_bonehand_index2pinky,
        v_bonehand_v
      );
      const v_bonehand_u = new THREE.Vector3().crossVectors(
        v_bonehand_v,
        v_bonehand_w
      );
      const R_Modelhand = new THREE.Matrix4().makeBasis(
        v_bonehand_u,
        v_bonehand_v,
        v_bonehand_w
      );
  
      const R_BonetoMP = R_MPhand.clone().multiply(
        R_Modelhand.clone().transpose()
      );
      const R_toTpose = R_chain_leftupper.clone().transpose();
      const R_wrist = R_BonetoMP.clone().premultiply(R_toTpose);
      boneHand.quaternion.setFromRotationMatrix(R_wrist);
  
      R_chain_leftupper.multiply(
        new THREE.Matrix4().extractRotation(boneHand.matrix)
      );
      let R_chain_index = new THREE.Matrix4().identity();
      let R_chain_middle = new THREE.Matrix4().identity();
      let R_chain_ring = new THREE.Matrix4().identity();
      let R_chain_pinky = new THREE.Matrix4().identity();
      let R_chain_thumb = new THREE.Matrix4().identity();
  
      let R_list = [
        R_chain_index,
        R_chain_middle,
        R_chain_ring,
        R_chain_pinky,
        R_chain_thumb,
      ];
  
      for (i = 0; i < 5; i++) {
        R_list[i].multiply(R_chain_leftupper);
      }
  
      for (i = 0; i < 15; i++) {
        let bone_list = [
          "index",
          "middle",
          "ring",
          "pinky",
          "thumb",
          "Index",
          "Middle",
          "Ring",
          "Pinky",
          "Thumb",
        ];
        let bone_point_list = ["mcp", "pip", "dip", "tip"];
        let remainder = i % 3;
        let quotient = parseInt(i / 3);
        let finger = bone_list[quotient];
        let finger_point = finger + "_finger_" + bone_point_list[remainder];
        let next_point = finger + "_finger_" + bone_point_list[remainder + 1];
        let Bone =
          "mixamorigLeftHand" + bone_list[quotient + 5] + (remainder + 1);
        let next_Bone =
          "mixamorigLeftHand" + bone_list[quotient + 5] + (remainder + 2);
        let R = R_list[quotient];
        SetRbyCalculatingJoints(
          hand_3d_landmarks[finger_point],
          hand_3d_landmarks[next_point],
          skeleton.getBoneByName(Bone),
          skeleton.getBoneByName(next_Bone),
          R
        );
      }
    }
    if (results.rightHandLandmarks) {
      let hand_landmarks_dict = {};
      results.rightHandLandmarks.forEach((landmark, i) => {
        hand_landmarks_dict[index_to_name_hands[i]] = landmark;
      });
      let hand_3d_landmarks = update3dpose(
        camera_world,
        1.5,
        new THREE.Vector3(1, 0, -1.5),
        hand_landmarks_dict
      );
      let i = 0;
      const gap_X = pose_right_wrist.x - hand_3d_landmarks["wrist"].x;
      const gap_Y = pose_right_wrist.y - hand_3d_landmarks["wrist"].y;
      const gap_Z = pose_right_wrist.z - hand_3d_landmarks["wrist"].z;
      for (const [key, value] of Object.entries(hand_3d_landmarks)) {
        value.x += gap_X;
        value.y += gap_Y;
        value.z += gap_Z;
        r_handlandmarks_points.geometry.attributes.position.array[3 * i + 0] =
          value.x;
        r_handlandmarks_points.geometry.attributes.position.array[3 * i + 1] =
          value.y;
        r_handlandmarks_points.geometry.attributes.position.array[3 * i + 2] =
          value.z;
        i++;
      }
      r_handlandmarks_points.geometry.attributes.position.needsUpdate = true;
      const jointWrist = hand_3d_landmarks["wrist"];
      const jointIndex_mcp = hand_3d_landmarks["index_finger_mcp"];
      const jointMiddle_mcp = hand_3d_landmarks["middle_finger_mcp"];
      const jointPinky_mcp = hand_3d_landmarks["pinky_finger_mcp"];
  
      const boneHand = skeleton.getBoneByName("mixamorigRightHand");
      const boneIndex1 = skeleton.getBoneByName("mixamorigRightHandIndex1");
      const boneMiddle1 = skeleton.getBoneByName("mixamorigRightHandMiddle1");
      const bonePinky1 = skeleton.getBoneByName("mixamorigRightHandPinky1");
  
      const v_middle = new THREE.Vector3().subVectors(
        jointMiddle_mcp,
        jointWrist
      );
  
      const v_hand_v = v_middle.clone().normalize();
      const v_hand_index2pinky = new THREE.Vector3()
        .subVectors(jointPinky_mcp, jointIndex_mcp)
        .normalize();
      const v_hand_w = new THREE.Vector3().crossVectors(
        v_hand_index2pinky,
        v_hand_v
      );
      const v_hand_u = new THREE.Vector3().crossVectors(v_hand_v, v_hand_w);
      const R_MPhand = new THREE.Matrix4().makeBasis(
        v_hand_u,
        v_hand_v,
        v_hand_w
      );
  
      const v_bonehand_v = boneMiddle1.clone().position.normalize();
      const v_bonehand_index2pinky = new THREE.Vector3()
        .subVectors(bonePinky1.position, boneIndex1.position)
        .normalize();
      const v_bonehand_w = new THREE.Vector3().crossVectors(
        v_bonehand_index2pinky,
        v_bonehand_v
      );
      const v_bonehand_u = new THREE.Vector3().crossVectors(
        v_bonehand_v,
        v_bonehand_w
      );
      const R_Modelhand = new THREE.Matrix4().makeBasis(
        v_bonehand_u,
        v_bonehand_v,
        v_bonehand_w
      );
  
      const R_BonetoMP = R_MPhand.clone().multiply(
        R_Modelhand.clone().transpose()
      );
      const R_toTpose = R_chain_rightupper.clone().transpose();
      const R_wrist = R_BonetoMP.clone().premultiply(R_toTpose);
      boneHand.quaternion.setFromRotationMatrix(R_wrist);
  
      R_chain_rightupper.multiply(
        new THREE.Matrix4().extractRotation(boneHand.matrix)
      );
      let R_chain_index = new THREE.Matrix4().identity();
      let R_chain_middle = new THREE.Matrix4().identity();
      let R_chain_ring = new THREE.Matrix4().identity();
      let R_chain_pinky = new THREE.Matrix4().identity();
      let R_chain_thumb = new THREE.Matrix4().identity();
  
      let R_list = [
        R_chain_index,
        R_chain_middle,
        R_chain_ring,
        R_chain_pinky,
        R_chain_thumb,
      ];
  
      for (i = 0; i < 5; i++) {
        R_list[i].multiply(R_chain_rightupper);
      }
  
      for (i = 0; i < 15; i++) {
        let bone_list = [
          "index",
          "middle",
          "ring",
          "pinky",
          "thumb",
          "Index",
          "Middle",
          "Ring",
          "Pinky",
          "Thumb",
        ];
        let bone_point_list = ["mcp", "pip", "dip", "tip"];
        let remainder = i % 3;
        let quotient = parseInt(i / 3);
        let finger = bone_list[quotient];
        let finger_point = finger + "_finger_" + bone_point_list[remainder];
        let next_point = finger + "_finger_" + bone_point_list[remainder + 1];
        let Bone =
          "mixamorigRightHand" + bone_list[quotient + 5] + (remainder + 1);
        let next_Bone =
          "mixamorigRightHand" + bone_list[quotient + 5] + (remainder + 2);
        let R = R_list[quotient];
        SetRbyCalculatingJoints(
          hand_3d_landmarks[finger_point],
          hand_3d_landmarks[next_point],
          skeleton.getBoneByName(Bone),
          skeleton.getBoneByName(next_Bone),
          R
        );
      }
    }
  
    renderer.render(scene, camera_ar);
    canvasCtx.restore();
  }
  