import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./socket";
import { playBell } from "./sound";
import { todayStr } from "./date";

const WorkflowContext = createContext(null);

export function WorkflowProvider({ children }) {
  const [connected, setConnected] = useState(socket.connected);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [boardColumns, setBoardColumns] = useState({});
  const [goal, setGoalState] = useState({ content: "", updatedBy: "", updatedAt: null, date: "" });
  const [tasks, setTasks] = useState([]);
  const [collabRequests, setCollabRequests] = useState([]);
  const [dayStart, setDayStart] = useState("09:00");
  const [dayEnd, setDayEnd] = useState("17:50");

  const [myTeam, setMyTeamState] = useState(() => localStorage.getItem("swf_myTeam") || "");
  const [myName, setMyNameState] = useState(() => localStorage.getItem("swf_myName") || "");
  const [incomingAlerts, setIncomingAlerts] = useState([]);
  const [teamAlert, setTeamAlert] = useState(false);

  const myTeamRef = useRef(myTeam);
  useEffect(() => {
    myTeamRef.current = myTeam;
  }, [myTeam]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teams")
      .then((res) => res.json())
      .then((list) => {
        if (!cancelled && Array.isArray(list) && list.length) setTeams(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onInit(state) {
      setTeams(state.teams || []);
      if (Array.isArray(state.members)) setMembers(state.members);
      setBoardColumns(state.boardColumns || {});
      setGoalState(state.goal || {});
      setTasks(state.tasks || []);
      setCollabRequests(state.collabRequests || []);
      if (state.dayStart) setDayStart(state.dayStart);
      if (state.dayEnd) setDayEnd(state.dayEnd);
    }
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onGoalUpdate(g) {
      setGoalState(g);
    }
    function onTaskCreate(t) {
      setTasks((prev) => [...prev, t]);
    }
    function onTaskUpdate(t) {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    }
    function onTaskDelete({ id }) {
      setTasks((prev) => prev.filter((x) => x.id !== id));
    }
    function onCollabCreate(r) {
      setCollabRequests((prev) => [...prev, r]);
      if (r.toTeam === myTeamRef.current) {
        playBell();
        setIncomingAlerts((prev) => [...prev, r]);
      }
    }
    function onCollabUpdate(r) {
      setCollabRequests((prev) => prev.map((x) => (x.id === r.id ? r : x)));
    }
    function onCollabDelete({ id }) {
      setCollabRequests((prev) => prev.filter((x) => x.id !== id));
    }
    function onBoardColumns(next) {
      setBoardColumns(next || {});
    }
    function onCollabRemind({ toTeam }) {
      if (toTeam === myTeamRef.current) playBell();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state:init", onInit);
    socket.on("goal:update", onGoalUpdate);
    socket.on("task:create", onTaskCreate);
    socket.on("task:update", onTaskUpdate);
    socket.on("task:delete", onTaskDelete);
    socket.on("collab:create", onCollabCreate);
    socket.on("collab:update", onCollabUpdate);
    socket.on("collab:delete", onCollabDelete);
    socket.on("collab:remind", onCollabRemind);
    socket.on("board:columns", onBoardColumns);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state:init", onInit);
      socket.off("goal:update", onGoalUpdate);
      socket.off("task:create", onTaskCreate);
      socket.off("task:update", onTaskUpdate);
      socket.off("task:delete", onTaskDelete);
      socket.off("collab:create", onCollabCreate);
      socket.off("collab:update", onCollabUpdate);
      socket.off("collab:delete", onCollabDelete);
      socket.off("collab:remind", onCollabRemind);
      socket.off("board:columns", onBoardColumns);
    };
  }, []);

  const setMyTeam = useCallback((id) => {
    setMyTeamState(id);
    localStorage.setItem("swf_myTeam", id);
  }, []);

  const setMyName = useCallback((name) => {
    setMyNameState(name);
    localStorage.setItem("swf_myName", name);
  }, []);

  const dismissAlert = useCallback((id) => {
    setIncomingAlerts((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const triggerTeamAlert = useCallback(() => {
    setTeamAlert(true);
    setTimeout(() => setTeamAlert(false), 1800);
  }, []);

  const teamName = useCallback(
    (id) => teams.find((t) => t.id === id)?.name || id,
    [teams]
  );

  const isLeader = myTeam === "management";

  const whoAmI = useMemo(() => {
    const label = myName?.trim() ? myName.trim() : "";
    const team = myTeam ? teamName(myTeam) : "";
    if (label && team) return `${label} (${team})`;
    return label || team || "익명";
  }, [myName, myTeam, teamName]);

  const identityChosen = Boolean(myTeam);

  const actions = useMemo(
    () => ({
      setGoal: (content) => socket.emit("goal:set", { content, updatedBy: whoAmI }),
      createTask: (teamId, time, endTime, title, memo, assignee, column) =>
        new Promise((resolve) => {
          socket.emit("task:create", { teamId, time, endTime, title, memo, assignee, column }, (task) => resolve(task));
        }),
      setTeamColumns: (teamId, count) => socket.emit("board:columns:set", { teamId, count }),
      updateTask: (id, patch) => socket.emit("task:update", { id, patch }),
      deleteTask: (id) => socket.emit("task:delete", { id }),
      addSubtask: (taskId, title, assignee) => socket.emit("task:subtask:add", { taskId, title, assignee }),
      toggleSubtask: (taskId, subtaskId) => socket.emit("task:subtask:toggle", { taskId, subtaskId }),
      updateSubtask: (taskId, subtaskId, patch) => socket.emit("task:subtask:update", { taskId, subtaskId, patch }),
      deleteSubtask: (taskId, subtaskId) => socket.emit("task:subtask:delete", { taskId, subtaskId }),
      createCollab: (fromTeam, toTeam, meetingTime, agenda) =>
        socket.emit("collab:create", { fromTeam, toTeam, meetingTime, agenda, requestedBy: whoAmI }),
      updateCollab: (id, patch) => socket.emit("collab:update", { id, patch }),
      deleteCollab: (id) => socket.emit("collab:delete", { id }),
      remindCollab: (id) => socket.emit("collab:remind", { id }),
    }),
    [whoAmI]
  );

  const today = todayStr();
  const todayGoal = useMemo(
    () => (goal.date === today ? goal : { date: today, content: "", updatedBy: "", updatedAt: null }),
    [goal, today]
  );
  const todayTasks = useMemo(() => tasks.filter((t) => t.date === today), [tasks, today]);
  const todayCollabRequests = useMemo(
    () => collabRequests.filter((r) => r.date === today),
    [collabRequests, today]
  );

  const value = {
    connected,
    teams,
    members,
    boardColumns,
    goal: todayGoal,
    tasks: todayTasks,
    collabRequests: todayCollabRequests,
    dayStart,
    dayEnd,
    myTeam,
    myName,
    isLeader,
    identityChosen,
    setMyTeam,
    setMyName,
    teamName,
    whoAmI,
    incomingAlerts,
    dismissAlert,
    teamAlert,
    triggerTeamAlert,
    ...actions,
  };

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflow must be used within WorkflowProvider");
  return ctx;
}
